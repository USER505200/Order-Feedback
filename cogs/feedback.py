import discord
from discord import app_commands
from discord.ext import commands
import config
import json
import os
from datetime import datetime

# ==========================================
# روابط الصور
# ==========================================
TOP_IMAGE_URL = "https://cdn.discordapp.com/attachments/1489497861350494339/1489723944582910002/word_1.gif?ex=69d1750a&is=69d0238a&hm=e9861e30bd5918e66c2d324e9bf21104bd21d8c18de12fb6cfa00681ce6f51e1&"
BOTTOM_IMAGE_URL = "https://cdn.discordapp.com/attachments/1489497861350494339/1489730355316392088/Untitled-1.gif?ex=69d17b02&is=69d02982&hm=91bba9f3cb622da72a3555f8a9ed89383f533898b0172e271605523595e1ce54&"

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def get_workers_in_channel(channel: discord.TextChannel):
    """جلب كل الأعضاء اللي معاهم رتبة Worker في الشانل المحدد"""
    workers = []
    if config.WORKER_ROLE_ID:
        worker_role = channel.guild.get_role(config.WORKER_ROLE_ID)
        if worker_role:
            for member in channel.members:
                if worker_role in member.roles and not member.bot:
                    workers.append(member)
    return workers

# ==========================================
# MODAL FOR FEEDBACK SUBMISSION
# ==========================================
class FeedbackModal(discord.ui.Modal, title="⭐ Submit Your Review"):
    description = discord.ui.TextInput(
        label="Your Review",
        placeholder="Write your review here...",
        style=discord.TextStyle.paragraph,
        required=True,
        max_length=1000
    )
    customer_name = discord.ui.TextInput(
        label="Your Name (Optional)",
        placeholder="Leave empty to stay anonymous",
        required=False,
        max_length=100
    )

    def __init__(self, channel: discord.TextChannel):
        super().__init__()
        self.channel = channel

    async def on_submit(self, interaction: discord.Interaction):
        workers_in_channel = get_workers_in_channel(self.channel)
        
        if not workers_in_channel:
            await interaction.response.send_message(
                "❌ No workers found in this channel/ticket. Make sure you have set the correct worker role and there are workers in this channel.",
                ephemeral=True
            )
            return
        
        # Embed للتقييم مع الصورة العلوية (thumbnail) والصورة السفلية (image)
        embed = discord.Embed(
            title="⭐ New Feedback Received ⭐",
            description=f"**Review from {'**' + self.customer_name.value + '**' if self.customer_name.value and self.customer_name.value.strip() else 'an anonymous customer'}**",
            color=discord.Color.from_rgb(184, 92, 26)
        )
        
        # الصورة العلوية على اليمين
        embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        # محتوى التقييم
        review_text = f"```{self.description.value}```"
        embed.add_field(name="📝 Review", value=review_text, inline=False)
        
        # التقييم بالنجوم
        stars = "⭐⭐⭐⭐⭐"
        embed.add_field(name="⭐ Rating", value=stars, inline=False)
        
        # اسم العميل
        if self.customer_name.value and self.customer_name.value.strip():
            customer_value = f"**{self.customer_name.value}**"
        else:
            customer_value = "*Anonymous*"
        embed.add_field(name="👤 Customer", value=customer_value, inline=True)
        
        # اسم الموظف (أول عامل في الشانل)
        worker_mention = workers_in_channel[0].mention if workers_in_channel else "Unknown"
        embed.add_field(name="👨‍💼 Worker", value=worker_mention, inline=True)
        
        current_time = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        embed.set_footer(text=f"Submitted • {current_time}")
        
        # الصورة السفلية
        embed.set_image(url=BOTTOM_IMAGE_URL)
        
        if config.FEEDBACK_CHANNEL_ID:
            feedback_channel = interaction.guild.get_channel(config.FEEDBACK_CHANNEL_ID)
            if feedback_channel:
                await feedback_channel.send(embed=embed)
                
                confirm_embed = discord.Embed(
                    title="✅ Review Submitted Successfully!",
                    description="**Thank you for your feedback!**\nYour review has been recorded and appreciated.",
                    color=discord.Color.green()
                )
                confirm_embed.set_thumbnail(url=TOP_IMAGE_URL)
                confirm_embed.set_footer(text="Grindora Services ⭐")
                
                await interaction.response.send_message(embed=confirm_embed, ephemeral=True)
            else:
                await interaction.response.send_message("❌ Feedback channel not found. Please contact an admin.", ephemeral=True)
        else:
            await interaction.response.send_message("❌ Feedback channel not set. Use `!setreviewchannel` to set it first.", ephemeral=True)

# ==========================================
# BUTTON VIEWS
# ==========================================
class FeedbackButton(discord.ui.View):
    def __init__(self, channel: discord.TextChannel):
        super().__init__(timeout=None)
        self.channel = channel

    @discord.ui.button(label="📝 Submit Review", style=discord.ButtonStyle.primary, custom_id="feedback_button", emoji="⭐")
    async def feedback_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(FeedbackModal(self.channel))

class MainFeedbackView(discord.ui.View):
    def __init__(self, channel: discord.TextChannel):
        super().__init__(timeout=None)
        self.add_item(FeedbackButton(channel).children[0])
        sythe_button = discord.ui.Button(
            label="Sythe Vouches",
            style=discord.ButtonStyle.link,
            url="https://www.sythe.org/threads/prime07-official-vouches/",
            emoji="📜"
        )
        self.add_item(sythe_button)

# ==========================================
# FEEDBACK COG
# ==========================================
class FeedbackCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    # ========== SLASH COMMAND ==========
    @app_commands.command(name="feedback", description="Submit a review for your completed order")
    async def slash_feedback(self, interaction: discord.Interaction):
        full_description = """**✨ Your order has been successfully delivered!** ✨

> 🔒 **Account Safety Reminder:**
> • Change your account password immediately
> • Log out of all active Jagex Launcher sessions
> 
> *For full protection, we highly recommend completing these steps now.*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 **Need more support or want another service?**
*We're always here to help you maximize your account's potential.*

🛒 **Explore all services:** <#1487243724865011822>
🎫 **Start a new order:** <#1487244035516006551>"""
        
        embed = discord.Embed(
            title="💎 Order Completed — Grindora Services 💎",
            description=full_description,
            color=discord.Color.from_rgb(184, 92, 26)
        )
        
        # الصورة العلوية على اليمين
        embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        # الصورة السفلية
        embed.set_image(url=BOTTOM_IMAGE_URL)
        
        # إضافة تذييل
        embed.set_footer(text="Grindora — Premier OSRS Services • Thank you for choosing us!")
        
        view = MainFeedbackView(interaction.channel)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=False)

    # ========== PREFIX COMMANDS ==========
    @commands.command(name="feedback", aliases=["f"])
    async def prefix_feedback(self, ctx):
        full_description = """**✨ Your order has been successfully delivered!** ✨

> 🔒 **Account Safety Reminder:**
> • Change your account password immediately
> • Log out of all active Jagex Launcher sessions
> 
> *For full protection, we highly recommend completing these steps now.*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 **Need more support or want another service?**
*We're always here to help you maximize your account's potential.*

🛒 **Explore all services:** <#1487243724865011822>
🎫 **Start a new order:** <#1487244035516006551>"""
        
        embed = discord.Embed(
            title="💎 Order Completed — Grindora Services ",
            description=full_description,
            color=discord.Color.from_rgb(184, 92, 26)
        )
        
        # الصورة العلوية على اليمين
        embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        # الصورة السفلية
        embed.set_image(url=BOTTOM_IMAGE_URL)
        
        # إضافة تذييل
        embed.set_footer(text="Grindora — Premier OSRS Services • Thank you for choosing us!")
        
        view = MainFeedbackView(ctx.channel)
        await ctx.send(embed=embed, view=view)

    @commands.command(name="commands", aliases=["menu", "cmds", "helpme"])
    async def commands_help(self, ctx):
        embed = discord.Embed(
            title="📋 Review Bot - Help Menu",
            description="Here are all available commands for the review system.",
            color=discord.Color.blue()
        )
        
        embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        embed.add_field(
            name="📝 **Review Commands**",
            value=(
                "`/feedback` - Start review (slash command)\n"
                "`!feedback` - Start review\n"
                "`!f` - Shortcut for review"
            ),
            inline=False
        )
        
        embed.add_field(
            name="⚙️ **Admin Commands**",
            value=(
                "`!roleworker <id>` - Set worker role by ID\n"
                "`!setreviewchannel <id>` - Set review channel\n"
                "`!reviewsettings` - Show current settings\n"
                "`!say <channel_id>` - Send welcome message\n"
                "`!commands` - Show this help menu"
            ),
            inline=False
        )
        
        worker_status = "❌ Not set"
        if config.WORKER_ROLE_ID:
            role = ctx.guild.get_role(config.WORKER_ROLE_ID)
            if role:
                worker_status = f"{role.mention} (ID: `{config.WORKER_ROLE_ID}`)"
            else:
                worker_status = f"ID: `{config.WORKER_ROLE_ID}` (Role not found)"
        
        channel_status = "❌ Not set"
        if config.FEEDBACK_CHANNEL_ID:
            channel = ctx.guild.get_channel(config.FEEDBACK_CHANNEL_ID)
            if channel:
                channel_status = f"{channel.mention} (ID: `{config.FEEDBACK_CHANNEL_ID}`)"
            else:
                channel_status = f"ID: `{config.FEEDBACK_CHANNEL_ID}` (Channel not found)"
        
        embed.add_field(
            name="🔧 **Current Settings**",
            value=(
                f"**Worker Role:** {worker_status}\n"
                f"**Review Channel:** {channel_status}"
            ),
            inline=False
        )
        
        embed.set_footer(text="Use !reviewsettings for detailed settings")
        embed.set_image(url=BOTTOM_IMAGE_URL)
        await ctx.send(embed=embed)

    @commands.command(name="roleworker")
    async def set_worker_role(self, ctx, role_id: str):
        if not ctx.author.guild_permissions.administrator:
            await ctx.send("❌ You need administrator permissions to use this command.")
            return
        
        try:
            role_id_int = int(role_id)
            role = ctx.guild.get_role(role_id_int)
            
            if role:
                config.WORKER_ROLE_ID = role_id_int
                self.save_settings()
                
                embed = discord.Embed(
                    title="✅ Worker Role Set",
                    description=f"Worker role has been set to: {role.mention} (ID: `{role_id_int}`)",
                    color=discord.Color.green()
                )
                embed.set_thumbnail(url=TOP_IMAGE_URL)
                await ctx.send(embed=embed)
            else:
                await ctx.send(f"❌ Role with ID `{role_id}` not found.")
        except ValueError:
            await ctx.send("❌ Please provide a valid numeric role ID.")

    @commands.command(name="setreviewchannel")
    async def set_review_channel(self, ctx, channel_id: str = None):
        if not ctx.author.guild_permissions.administrator:
            await ctx.send("❌ You need administrator permissions to use this command.")
            return
        
        if channel_id is None:
            channel = ctx.channel
            config.FEEDBACK_CHANNEL_ID = channel.id
            self.save_settings()
            
            embed = discord.Embed(
                title="✅ Review Channel Set",
                description=f"Review channel has been set to: {channel.mention} (ID: `{channel.id}`)",
                color=discord.Color.green()
            )
            embed.set_thumbnail(url=TOP_IMAGE_URL)
            await ctx.send(embed=embed)
            return
        
        try:
            channel_id_int = int(channel_id)
            channel = ctx.guild.get_channel(channel_id_int)
            
            if channel and isinstance(channel, discord.TextChannel):
                config.FEEDBACK_CHANNEL_ID = channel_id_int
                self.save_settings()
                
                embed = discord.Embed(
                    title="✅ Review Channel Set",
                    description=f"Review channel has been set to: {channel.mention} (ID: `{channel_id_int}`)",
                    color=discord.Color.green()
                )
                embed.set_thumbnail(url=TOP_IMAGE_URL)
                await ctx.send(embed=embed)
            else:
                await ctx.send(f"❌ Channel with ID `{channel_id}` not found or is not a text channel.")
        except ValueError:
            await ctx.send("❌ Please provide a valid numeric channel ID.")

    @commands.command(name="reviewsettings")
    async def show_settings(self, ctx):
        embed = discord.Embed(
            title="⚙️ Review System Settings",
            color=discord.Color.blue()
        )
        
        embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        if config.WORKER_ROLE_ID:
            role = ctx.guild.get_role(config.WORKER_ROLE_ID)
            if role:
                embed.add_field(name="👥 Worker Role", value=f"{role.mention} (ID: `{config.WORKER_ROLE_ID}`)", inline=False)
            else:
                embed.add_field(name="👥 Worker Role", value=f"ID: `{config.WORKER_ROLE_ID}` (Role not found)", inline=False)
        else:
            embed.add_field(name="👥 Worker Role", value="❌ Not set", inline=False)
        
        if config.FEEDBACK_CHANNEL_ID:
            channel = ctx.guild.get_channel(config.FEEDBACK_CHANNEL_ID)
            if channel:
                embed.add_field(name="📢 Review Channel", value=f"{channel.mention} (ID: `{config.FEEDBACK_CHANNEL_ID}`)", inline=False)
            else:
                embed.add_field(name="📢 Review Channel", value=f"ID: `{config.FEEDBACK_CHANNEL_ID}` (Channel not found)", inline=False)
        else:
            embed.add_field(name="📢 Review Channel", value="❌ Not set", inline=False)
        
        embed.set_footer(text="Use !roleworker <id> and !setreviewchannel <id> to set these")
        embed.set_image(url=BOTTOM_IMAGE_URL)
        await ctx.send(embed=embed)

    @commands.command(name="say")
    async def say_message(self, ctx, channel_id: str = None):
        if not ctx.author.guild_permissions.administrator:
            await ctx.send("❌ You need administrator permissions to use this command.")
            return
        
        if channel_id:
            try:
                channel_id_int = int(channel_id)
                target_channel = ctx.guild.get_channel(channel_id_int)
                if not target_channel:
                    await ctx.send(f"❌ Channel with ID `{channel_id}` not found.")
                    return
            except ValueError:
                await ctx.send("❌ Please provide a valid channel ID.")
                return
        else:
            target_channel = ctx.channel
        
        full_description = """**✨ Your order has been successfully delivered!** ✨

> 🔒 **Account Safety Reminder:**
> • Change your account password immediately
> • Log out of all active Jagex Launcher sessions
> 
> *For full protection, we highly recommend completing these steps now.*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 **Need more support or want another service?**
*We're always here to help you maximize your account's potential.*

🛒 **Explore all services:** <#1487243724865011822>
🎫 **Start a new order:** <#1487244035516006551>"""
        
        embed = discord.Embed(
            title="💎 Order Completed — Grindora Services 💎",
            description=full_description,
            color=discord.Color.from_rgb(184, 92, 26)
        )
        
        # الصورة العلوية على اليمين
        embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        # الصورة السفلية
        embed.set_image(url=BOTTOM_IMAGE_URL)
        
        # إضافة تذييل
        embed.set_footer(text="Grindora — Premier OSRS Services • Thank you for choosing us!")
        
        view = MainFeedbackView(target_channel)
        await target_channel.send(embed=embed, view=view)
        await ctx.send(f"✅ Message sent to {target_channel.mention}")

    def save_settings(self):
        """حفظ الإعدادات في ملف"""
        settings = {
            "worker_role_id": config.WORKER_ROLE_ID,
            "feedback_channel_id": config.FEEDBACK_CHANNEL_ID
        }
        with open("settings.json", "w") as f:
            json.dump(settings, f)

async def setup(bot):
    await bot.add_cog(FeedbackCog(bot))
    print("✅ FeedbackCog loaded")