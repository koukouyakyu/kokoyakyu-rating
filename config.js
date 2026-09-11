/*
  Supabaseの Project URL と Publishable key を貼り付けてください。

  例:
  supabaseUrl: "https://abcdefghijk.supabase.co",
  supabasePublishableKey: "sb_publishable_xxxxxxxxxxxxx"

  注意:
  sb_secret_... は絶対にここへ入れないでください。
*/

window.APP_CONFIG = {
  supabaseUrl: "PASTE_YOUR_SUPABASE_URL_HERE",
  supabasePublishableKey: "PASTE_YOUR_PUBLISHABLE_KEY_HERE",

  rating: {
    initial: 1500,
    divisor: 600,
    defaultK: 10,

    // 大会別にK値を変える場合だけ追加してください。
    // 例:
    // tournamentK: {
    //   "夏の甲子園": 12,
    //   "春の甲子園": 12
    // }
    tournamentK: {}
  },

  // 検索していない通常表示時の最大件数
  rankingLimit: 200
};
