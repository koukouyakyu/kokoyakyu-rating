/*
  高校野球 Rating - Supabase設定

  Supabase接続情報とRating計算設定をまとめています。

  注意:
  - 使用するのは Publishable key です。
  - sb_secret_... や Service Role key は
    絶対にGitHubへアップロードしないでください。
*/

window.APP_CONFIG = {
  // Supabase Project URL
  supabaseUrl: "https://sbupvnuqbafestxiarkd.supabase.co",

  // Supabase Publishable key
  supabasePublishableKey:
    "sb_publishable_SdmaFoqdL0K9ENQLe2VXHw_TheG63ye",

  // Rating計算設定
  rating: {
    // 全校の初期Rating
    initial: 1500,

    // 期待値計算
    // We = 1 / (1 + 10^(-D / divisor))
    divisor: 600,

    // 通常試合のK値
    defaultK: 10,

    // 大会別にK値を変更したい場合に設定
    // 現在は未設定なので、すべてdefaultK = 10
    tournamentK: {}
  },

  // 全国ランキングで通常表示する最大校数
  // 学校検索時は全校が検索対象になります
  rankingLimit: 200
};
