FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

RUN addgroup --system quakecurrent \
    && adduser --system --ingroup quakecurrent quakecurrent

RUN pip install --no-cache-dir uv==0.12.0

COPY pyproject.toml uv.lock .python-version ./

RUN uv sync --locked --no-install-project --no-editable

COPY alembic.ini ./
COPY alembic ./alembic
COPY src ./src

RUN uv sync --locked --no-editable

ENV PATH="/app/.venv/bin:$PATH"

USER quakecurrent

EXPOSE 8000

CMD ["uvicorn", "quakecurrent.main:app", "--host", "0.0.0.0", "--port", "8000"]
