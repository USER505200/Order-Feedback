// Grindora brand on every embed this bot sends or edits (and no duplicate messages, see enforceNonce below):
// - the brand banner under the message's embeds when none of them has an image of its own;
// - dead image links (Gyazo, expired or unsigned Discord attachment links) replaced: pictures we still
//   have get their own hosted copy back, other big images get the banner, icons/thumbnails the logo.
// - the old logos (brown logo, old server icon, Gyazo logos) always become the red animated logo.
// It works on the final message body (discord.js MessagePayload), so every send, reply, edit, follow-up
// and webhook goes through it. BRAND_BANNER_ENABLED=false turns the banner off (dead links are still fixed).
const { MessagePayload } = require('discord.js');

const BANNER = process.env.BRAND_BANNER_URL || 'https://gdrosrs.com/assets/brand/grindora-banner.gif';
const LOGO = process.env.BRAND_LOGO_URL || 'https://gdrosrs.com/assets/brand/grindora-logo-red.gif';
const MENU_BANNER = 'https://gdrosrs.com/assets/brand/grindora-menu-banner.gif';

// Dead links whose picture we still have: they get their own copy back instead of the generic banner/logo.
const KNOWN = [
  ['grindoraserv.gif', MENU_BANNER], // price menu banner
  ['Comp_1.gif', LOGO],
  ['d42528bebd6b1b64d252fe5c537687f9', LOGO], // bot icon (Gyazo)
  ['8635ffb294608c3771a1b0678fae2b7c', LOGO], // verify logo (Gyazo)
  ['5e40d14f6bf9ee0215d3f336372fbcb5', BANNER], // old banner (Gyazo)
];

// Logos we no longer use, even where the link still loads: the red logo replaces them.
const OLD_LOGOS = [
  '/assets/brand/grindora-logo.gif', // brown/orange logo
  '/icons/1487197600456249378/', // old server icon (also through images-ext)
  'Comp_1.gif',
  'd42528bebd6b1b64d252fe5c537687f9',
  '8635ffb294608c3771a1b0678fae2b7c',
];

function isOldLogo(url) {
  const value = String(url || '');
  return OLD_LOGOS.some((key) => value.includes(key));
}

function replacementFor(url, fallback) {
  const hit = KNOWN.find(([key]) => String(url).includes(key));
  return hit ? hit[1] : fallback;
}

function isDead(url) {
  const value = String(url || '');
  if (/^https?:\/\/(i\.)?gyazo\.com\//i.test(value)) return true;
  if (!/^https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/attachments\//i.test(value)) return false;
  // Discord attachment links carry their expiry (ex=, hex seconds); unsigned ones no longer load at all.
  const m = value.match(/[?&]ex=([0-9a-f]+)/i);
  return !m || parseInt(m[1], 16) * 1000 < Date.now() + 60 * 60 * 1000;
}

function brandEmbeds(embeds) {
  if (!Array.isArray(embeds) || !embeds.length) return embeds;
  for (const embed of embeds) {
    if (!embed || typeof embed !== 'object') continue;
    if (embed.image?.url && isDead(embed.image.url)) embed.image = { url: replacementFor(embed.image.url, BANNER) };
    if (isOldLogo(embed.thumbnail?.url)) embed.thumbnail = { url: LOGO };
    else if (embed.thumbnail?.url && isDead(embed.thumbnail.url)) embed.thumbnail = { url: replacementFor(embed.thumbnail.url, LOGO) };
    for (const part of [embed.author, embed.footer]) {
      if (!part?.icon_url) continue;
      if (isOldLogo(part.icon_url)) part.icon_url = LOGO;
      else if (isDead(part.icon_url)) part.icon_url = replacementFor(part.icon_url, LOGO);
    }
  }
  if (process.env.BRAND_BANNER_ENABLED !== 'false' && !embeds.some((embed) => embed?.image?.url)) {
    const last = embeds[embeds.length - 1];
    if (last && typeof last === 'object') last.image = { url: BANNER };
  }
  return embeds;
}

if (!MessagePayload.prototype.__grindoraBrand) {
  const resolveBody = MessagePayload.prototype.resolveBody;
  MessagePayload.prototype.resolveBody = function brandedResolveBody(...args) {
    // No duplicate messages: when Discord answers a send after more than 15s, discord.js times out and
    // sends the same request again, and the first one had gone through (the reply showed up twice).
    // With a nonce on every message Discord returns the first message instead of creating a second one.
    const clientOptions = this.target?.client?.options;
    if (clientOptions && !clientOptions.enforceNonce) clientOptions.enforceNonce = true;
    const result = resolveBody.apply(this, args);
    try {
      brandEmbeds(this.body?.embeds);
      if (this.body?.data?.embeds) brandEmbeds(this.body.data.embeds);
    } catch (error) {
      console.warn('[brand] could not brand embeds:', error.message);
    }
    return result;
  };
  MessagePayload.prototype.__grindoraBrand = true;
}

module.exports = { brandEmbeds, isDead, isOldLogo, replacementFor, BANNER, LOGO, MENU_BANNER };
