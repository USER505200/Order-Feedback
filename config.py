import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv('DISCORD_TOKEN')
GUILD_ID = 1487197600456249378

# ========== إعدادات نظام التقييمات (Feedback) ==========
WORKER_ROLE_ID = None      # سيتم تحميلها من settings.json
FEEDBACK_CHANNEL_ID = None # سيتم تحميلها من settings.json

# ========== إعدادات معالج الصور ==========
IMAGE_CHANNEL_ID = 1488874453965209630      # القناة اللي بترسل فيها الصور

# ========== إعدادات أوامر الطلبات ==========
ORDER_CHANNEL_ID = 1487245643637588078      # القناة اللي بيتبع فيها الـ Embed
ALLOWED_ROLE_IDS = [
    1487299337041215508,  # الرتبة الأولى
    1487299732215697469   # الرتبة الثانية
]