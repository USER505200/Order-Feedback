FROM python:3.12-slim

WORKDIR /app

# نسخ الملفات المطلوبة
COPY requirements.txt .
COPY *.py .
COPY cogs/ ./cogs/

# تثبيت المتطلبات
RUN pip install --no-cache-dir -r requirements.txt

# تشغيل البوت
CMD ["python", "main.py"]