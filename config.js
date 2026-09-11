/*
  高校野球 Rating - Supabase設定

  変更するのは基本的に次の2か所だけです。

  1. supabaseUrl
  2. supabasePublishableKey

  注意:
  sb_secret_... は絶対にGitHubへ載せないでください。
  使用するのは sb_publishable_... です。
*/

window.APP_CONFIG = {
  // SupabaseのProject URL
  // 例:
  // https://abcdefghijk.supabase.co
  supabaseUrl: "YOUR_PROJECT_URL",

  // SupabaseのPublishable key
  // 例:
  // sb_publishable_xxxxxxxxxxxxxxxxxxxxx
  supabasePublishableKey: "YOUR_PUBLISHABLE_KEY",

  // Rating計算設定
  rating: {
    // 全学校の初期Rating
    initial: 1500,

    // 期待値計算の除数
    // We = 1 / (1 + 10^(-D/divisor))
    divisor: 600,

    // 通常のK値
    defaultK: 10,

    // 大会ごとにK値を変更したい場合に使用
    // 現在はすべて既定値10
    tournamentK: {
      /*
      "夏の甲子園": 12,
      "春の甲子園": 12,
      "大阪大会": 10
      */
    }
  },

  // ランキング画面で通常表示する最大校数
  // 検索時は全校が対象
  rankingLimit: 200
};
