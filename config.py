import os

# قراءة التوكن مباشرة من متغيرات البيئة
TOKEN = os.environ.get('DISCORD_TOKEN')

# إذا لم يجد، حاول من ملف .env (للمحلي)
if not TOKEN:
    try:
        from dotenv import load_dotenv
        load_dotenv()
        TOKEN = os.getenv('DISCORD_TOKEN')
    except:
        pass

# التأكد من وجود التوكن
if not TOKEN:
    raise ValueError("❌ DISCORD_TOKEN environment variable is not set!")

# الإعدادات
GUILD_ID = 1487197600456249378
WORKER_ROLE_ID = None
FEEDBACK_CHANNEL_ID = None
IMAGE_CHANNEL_ID = 1488874453965209630
ORDER_CHANNEL_ID = 1487245643637588078
ALLOWED_ROLE_IDS = [1487299337041215508, 1487299732215697469]

print(f"✅ Config loaded. Token exists: {bool(TOKEN)}")