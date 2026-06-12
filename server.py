from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import base64
from email.parser import BytesParser
from email.policy import default
import json
import os
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/openai-models":
            self.openai_models()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/analyze-image":
            self.analyze_image()
            return
        self.send_error(404, "Not found")

    def openai_models(self):
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            self.json_response(503, {"error": "OPENAI_API_KEY no esta configurada."})
            return

        try:
            req = urllib.request.Request(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {key}"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            self.json_response(exc.code, {"error": "No se pudieron leer los modelos.", "details": details})
            return
        except Exception as exc:
            self.json_response(502, {"error": f"No se pudieron leer los modelos: {exc}"})
            return

        ids = sorted(item.get("id", "") for item in payload.get("data", []) if item.get("id"))
        candidates = self.model_candidates()
        self.json_response(
            200,
            {
                "models": ids,
                "configured_candidates": candidates,
                "matching_candidates": [model for model in candidates if model in ids],
            },
        )

    def analyze_image(self):
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            self.json_response(
                503,
                {
                    "error": "OPENAI_API_KEY no esta configurada. Use la carga manual por ahora."
                },
            )
            return

        form = self.parse_multipart()
        image_field = form.get("image")
        if image_field is None:
            self.json_response(400, {"error": "Falta la imagen."})
            return

        image_bytes = image_field["data"]
        if len(image_bytes) > 8 * 1024 * 1024:
            self.json_response(400, {"error": "La imagen supera 8 MB."})
            return

        known_items = form.get("known_items", {}).get("text", "[]")
        media_type = image_field["content_type"] or "image/jpeg"
        data_url = f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
        models = self.model_candidates()

        prompt = (
            "Sos un asistente para un almacen. Lee la foto de una factura, ticket, "
            "remito o lista de compra. Devolve SOLO JSON valido con esta forma: "
            '{"items":[{"name":"producto","quantity":1,"unit_price":0}],"notes":""}. '
            "quantity es cantidad comprada; si no se ve, usa 1. unit_price es precio "
            "unitario final para vender o costo visible; si no se ve, usa 0. "
            "Normaliza nombres comparando contra estos productos pendientes/existentes: "
            f"{known_items}"
        )

        payload = None
        last_model_error = ""
        for model in models:
            body = {
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
                "temperature": 0,
                "response_format": {"type": "json_object"},
            }

            try:
                req = urllib.request.Request(
                    "https://api.openai.com/v1/chat/completions",
                    data=json.dumps(body).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=60) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as exc:
                details = exc.read().decode("utf-8", errors="replace")
                print(f"OpenAI HTTP error {exc.code} with {model}: {details}")
                if self.is_model_access_error(details):
                    last_model_error = details
                    continue
                self.json_response(
                    exc.code,
                    {"error": "La IA rechazo la solicitud.", "details": details},
                )
                return
            except Exception as exc:
                self.json_response(502, {"error": f"No se pudo analizar la imagen: {exc}"})
                return

        if payload is None:
            self.json_response(
                403,
                {
                    "error": "La cuenta de OpenAI no tiene acceso a los modelos configurados.",
                    "tried_models": models,
                    "details": last_model_error,
                },
            )
            return

        content = payload["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            self.json_response(502, {"error": "La IA no devolvio JSON valido.", "raw": content})
            return
        self.json_response(200, parsed)

    def model_candidates(self):
        candidates = []
        preferred = os.environ.get("OPENAI_MODEL")
        if preferred:
            candidates.append(preferred)
        candidates.extend(
            [
                "gpt-5-mini",
                "gpt-5.1-mini",
                "gpt-5.4-mini",
                "gpt-4.1-mini",
                "gpt-4o-mini",
                "gpt-4.1",
                "gpt-4o",
            ]
        )
        return list(dict.fromkeys(candidates))

    def is_model_access_error(self, details):
        text = details.lower()
        return (
            "does not have access to model" in text
            or "model_not_found" in text
            or "does not exist or you do not have access" in text
        )

    def parse_multipart(self):
        length = int(self.headers.get("Content-Length", "0"))
        content_type = self.headers.get("Content-Type", "")
        raw_body = self.rfile.read(length)
        message = BytesParser(policy=default).parsebytes(
            f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8")
            + raw_body
        )
        fields = {}
        for part in message.iter_parts():
            disposition = part.get("Content-Disposition", "")
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue
            data = part.get_payload(decode=True) or b""
            fields[name] = {
                "data": data,
                "text": data.decode(part.get_content_charset() or "utf-8", errors="replace"),
                "filename": part.get_filename(),
                "content_type": part.get_content_type(),
                "disposition": disposition,
            }
        return fields

    def json_response(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Compras y precios: http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
