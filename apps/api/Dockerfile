FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN addgroup --system quakecurrent \
    && adduser --system --ingroup quakecurrent quakecurrent

COPY pyproject.toml alembic.ini ./
COPY alembic ./alembic
COPY src ./src

RUN pip install --no-cache-dir .

USER quakecurrent

EXPOSE 8000

CMD ["uvicorn", "quakecurrent.main:app", "--host", "0.0.0.0", "--port", "8000"]
