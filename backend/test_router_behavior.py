from sqlmodel import Session
from database import get_session
from routers.ai import get_gemini_service
import json

session_generator = get_session()
session = next(session_generator)

ai_service = get_gemini_service(session)
print(f"Is Configured: {ai_service.is_configured}")
print(f"API Key: {ai_service.api_key}")

result = ai_service.enhance_ticket(
    name="Implement user authentication",
    description_stub="Use jwt token",
    context="Testing vertical slices"
)
print("Result:")
print(json.dumps(result, indent=2))
