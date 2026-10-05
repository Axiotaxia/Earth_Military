function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discordToken: required('DISCORD_BOT_TOKEN'),
  apiSecret: required('BOT_API_SECRET'),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  mainServerId: required('MAIN_SERVER_ID'),
  mainEventsChannelId: required('MAIN_EVENTS_CHANNEL_ID'),
  militaryServerId: required('MILITARY_SERVER_ID'),
  militaryCohostChannelId: required('MILITARY_COHOST_REQUEST_CHANNEL_ID'),
  militaryVerifyChannelId: process.env.MILITARY_VERIFY_CHANNEL_ID || '',
  verificationRoleId: process.env.VERIFICATION_ROLE_ID || '',
  enlistedRoleId: process.env.ENLISTED_ROLE_ID || '',
  verificationSiteUrl: process.env.VERIFICATION_SITE_URL || '',

  roleIds: {
    soldier: required('SOLDIER_ROLE_ID'),
    citizen: required('CITIZEN_ROLE_ID'),
    private: required('PRIVATE_ROLE_ID'),
  },

  // Optional at boot, but Discord<->Roblox verification is disabled without it
  bloxlinkApiKey: process.env.BLOXLINK_API_KEY || '',

  port: process.env.PORT || 3000,
};
