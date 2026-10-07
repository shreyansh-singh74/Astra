from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers import analysis, assignments, evaluation, openrouter, settings, submissions, vault
from backend.app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_if_empty()
    yield


app = FastAPI(title="Astra API", lifespan=lifespan)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assignments.router)
app.include_router(vault.router)
app.include_router(submissions.router)
app.include_router(analysis.router)
app.include_router(openrouter.router)
app.include_router(evaluation.router)
app.include_router(settings.router)


@app.get("/")
def read_root():
    return {"message": "Astra Backend API is active"}
