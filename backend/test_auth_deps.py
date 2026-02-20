import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

try:
    print("Testing Pydantic...")
    from pydantic import EmailStr, BaseModel
    class T(BaseModel):
        e: EmailStr
    T(e="test@example.com")
    print("Pydantic OK")

    print("Testing Passlib/Bcrypt...")
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    h = pwd_context.hash("password123")
    print(f"Hashing OK: {h[:10]}...")

    print("Testing Jose/JWT...")
    from jose import jwt
    token = jwt.encode({"sub": "test"}, "secret", algorithm="HS256")
    print(f"JWT OK: {token[:10]}...")

    print("All tests passed locally!")

except Exception as e:
    print(f"CRASH: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
