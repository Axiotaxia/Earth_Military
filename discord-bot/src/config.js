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

  roleIds: {
    soldier: required('SOLDIER_ROLE_ID'),
    citizen: required('CITIZEN_ROLE_ID'),
    private: required('PRIVATE_ROLE_ID'),
  },

  port: process.env.PORT || 3000,
};
