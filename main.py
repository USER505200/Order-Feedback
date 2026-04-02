import discord
from discord.ext import commands
import config
import json
import os

intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)

# ملف حفظ إعدادات التقييمات
SETTINGS_FILE = "settings.json"

def load_feedback_settings():
    """تحميل إعدادات التقييمات من الملف"""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                settings = json.load(f)
                config.WORKER_ROLE_ID = settings.get("worker_role_id")
                config.FEEDBACK_CHANNEL_ID = settings.get("feedback_channel_id")
                print(f"📁 Loaded feedback settings: Worker={config.WORKER_ROLE_ID}, Channel={config.FEEDBACK_CHANNEL_ID}")
        except Exception as e:
            print(f"Error loading settings: {e}")

async def load_cogs():
    """تحميل جميع الـ Cogs"""
    await bot.load_extension("cogs.feedback")
    await bot.load_extension("cogs.image_handler")
    await bot.load_extension("cogs.order_modal")
    print("✅ All cogs loaded")

@bot.event
async def on_ready():
    # تحميل إعدادات التقييمات
    load_feedback_settings()
    
    print(f'✅ Logged in as {bot.user} (ID: {bot.user.id})')
    print(f'📁 Bot is in {len(bot.guilds)} guilds')
    
    await load_cogs()
    
    # سينك الأوامر السلاكية
    try:
        synced = await bot.tree.sync()
        print(f"✅ Synced {len(synced)} slash commands")
    except Exception as e:
        print(f"Error syncing commands: {e}")
    
    print(f"""
    ═══════════════════════════════════════
    📸 Image channel: {config.IMAGE_CHANNEL_ID}
    📝 Order channel: {config.ORDER_CHANNEL_ID}
    👑 Allowed roles: {config.ALLOWED_ROLE_IDS}
    👥 Worker role: {config.WORKER_ROLE_ID}
    📢 Feedback channel: {config.FEEDBACK_CHANNEL_ID}
    ═══════════════════════════════════════
    """)

if __name__ == "__main__":
    bot.run(config.TOKEN)