FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY tests ./tests
EXPOSE 8000
ENV SPONSOR_OPS_DB=/data/sponsor_ops.db
CMD ["python","-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
