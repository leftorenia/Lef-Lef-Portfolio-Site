# Cosmic Portfolio Layout Expansion Design

## Goal

既存の「Silent Cosmos」ビジュアルを維持しながら、参考サイトの情報構成を取り入れる。作者名とアイコンをサイト上部の中心要素にし、Profileでは名前とアイコンを対にして見せる。Worksは3列を基本とするカード一覧へ変更し、実在する作品は個別詳細ページへ遷移できるようにする。

現時点で確認できる作品は `COSMO EFFECTS` の1件だけとする。未確認の作品は追加せず、構成確認と将来拡張のために6件の `COMING SOON` 枠を表示する。

## Reference boundary

参考サイトから取り入れるのは次の構成上の特徴だけとする。

- アイコンと名前をまとめた中央配置のマストヘッド
- マストヘッド直下の明快なナビゲーション
- Profileにおける大きな名前と人物アイコンの対置
- Worksにおける3列カードグリッドと詳細への遷移

参考サイトのロゴ、画像、書体、配色、余白値、文言、カード画像、装飾は複製しない。既存サイトの黒、紫、青、淡い白を使った宇宙表現と、CSS／Canvasで生成するビジュアルを継続する。

## Information architecture

公開ナビゲーションは引き続き3項目とする。

1. `PROFILE` — `/index.html`
2. `WORKS` — `/works.html`
3. `CONTACT` — `/contact.html`

旧 `/about.html` は `/index.html` への互換転送として残す。

作品詳細は作品ごとのディレクトリに置く。

- `/works/cosmo-effects/index.html`
- 将来の追加例: `/works/example-work/index.html`

この形式により、作品追加時にルート直下へ詳細ページが散らばることを避ける。

## Shared masthead

全ページのヘッダーを2段構成へ変更する。

- 上段中央: CSSで描く円形の `LF` アイコンと `LEFLEF` のワードマーク
- 下段中央: `PROFILE / WORKS / CONTACT` のナビゲーション

アイコンと名前を一つのブランドリンクとして扱い、Profileへ戻れるようにする。現在ページは `aria-current="page"` と発光する下線で示す。詳細ページでは `WORKS` を現在ページとして示す。

ヘッダーは内容を覆わない通常フローのマストヘッドとし、スクロール後も本文の広い表示領域を確保する。モバイルではワードマークとナビを縮小するが、3項目は省略しない。

## Profile layout

Profileの導入部は2列構成にする。

- 左列: ページラベル、`LEFLEF`、`れふれふ`、`Shader / VFX Explorer`、日本語の紹介、Worksへのリンク
- 右列: 画像を使わずCSSで生成する大きな円形LFアイコン。軌道線、星、淡いネビュラを組み合わせる

人物写真や未提供のアバター画像は作らない。右側のアイコンはブランドマークを拡張した抽象表現とし、作者の識別と宇宙テーマの両方を担う。

既存の紹介文と探究領域 `SHADER / REALTIME VFX / UNITY / VISUAL STUDY` は維持する。

## Works grid

`works.html` は7枚のカードを持つ。

1. `W.001 / COSMO EFFECTS` — クリック可能な実在作品カード
2. `W.002 / COMING SOON` — 非リンク
3. `W.003 / COMING SOON` — 非リンク
4. `W.004 / COMING SOON` — 非リンク
5. `W.005 / COMING SOON` — 非リンク
6. `W.006 / COMING SOON` — 非リンク
7. `W.007 / COMING SOON` — 非リンク

デスクトップでは3列、タブレットでは2列、モバイルでは1列にする。すべて同じ基本寸法と角丸を使い、一覧として整ったリズムを作る。

`COSMO EFFECTS` カード全体を `/works/cosmo-effects/index.html` へのリンクにする。既存のCanvas生成プレビューを縮小サムネイルとして使用し、タイトル、`Unity VFX Study / Personal Study`、説明、使用技術を表示する。リンクであることは矢印、ホバー、キーボードフォーカスで示す。

`COMING SOON` は `<article>` として表示し、リンク、矢印、クリック演出を付けない。Canvasの代わりにCSSのみの静かな軌道・グリッド・星粒を置く。利用できない操作があるように見せない。

## COSMO EFFECTS detail page

`/works/cosmo-effects/index.html` は次の順で構成する。

1. Works一覧へ戻るリンク
2. `W.001`、`COSMO EFFECTS`、`Unity VFX Study`
3. 大きなCanvas生成ビジュアル
4. 作品概要
5. 表現テーマ: 星のきらめき、軌道、流星、星座、紫から青へ移る光、粒子密度による奥行き
6. 使用技術: `UNITY / SHADER / PARTICLE SYSTEM / REALTIME VFX`
7. Works一覧とContactへの導線

クライアント、雇用、公開実績、受注実績、賞歴など未確認の情報は追加しない。制作年はユーザー確認前の断定を避け、数値の年を表示せず `PERSONAL STUDY` と表記する。

詳細ページでも `assets/js/cosmic-field.js` を共通背景として読み込み、作品ビジュアルには `assets/js/work-preview.js` を再利用する。詳細ページからの相対パスは `../../assets/...` とする。

## Future work addition

新しい作品を追加するときは次の手順だけで済む構造にする。

1. `works.html` のComing Soonカード1枚をリンク付き作品カードへ置換する
2. `works/<slug>/index.html` を既存詳細ページから複製する
3. タイトル、種別、説明、技術、ページ固有のメタ情報を更新する
4. 一覧と詳細ページのローカルリンクテストを実行する

READMEへこの追加手順を記載する。データ駆動レンダリングやビルド工程は追加せず、HTMLだけで内容を確認できる状態を守る。

## Responsive behavior

- `1100px` 以上: Works 3列、Profileは左右2列
- `720px` 以上 `1099px` 以下: Works 2列、Profileは1列へ切り替え、LFアイコンを紹介文の下へ中央配置
- `719px` 以下: Works 1列、Profileは縦並び、ブランドとナビは中央配置のまま縮小

横スクロールを発生させない。CanvasはCSS寸法へ追従し、端末回転やライブリサイズでも再計測する。

## Accessibility and motion

- ブランドリンク、ナビ、作品リンク、戻るリンクに明瞭なキーボードフォーカスを付ける
- 作品カードは見出し構造を持ち、リンク名だけで遷移先が理解できるようにする
- Coming Soonはリンクとして公開せず、スクリーンリーダーにも利用可能な作品と誤認させない
- 装飾CanvasとCSSアイコンは `aria-hidden="true"` とする
- `prefers-reduced-motion: reduce` ではCanvasを静止表示し、設定変更にも即時追従する
- JavaScriptが失敗してもブランド、ナビ、本文、作品名、Coming Soon枠は表示する

## Files

主な変更対象:

- `index.html` — Profileの名前／アイコン2列構成
- `works.html` — 7カードの3列グリッド
- `contact.html` — 新しい共通マストヘッドへ整合
- `assets/css/style.css` — マストヘッド、Profile、カードグリッド、詳細ページ、レスポンシブ
- `assets/js/work-preview.js` — 一覧と詳細の両Canvasで再利用。新しい作品データは持たせない
- `works/cosmo-effects/index.html` — 新規詳細ページ
- `README.md` — 作品追加手順
- `tests/site-structure.test.mjs` — ページ、カード、リンク、Coming Soon数
- `tests/style-contract.test.mjs` — 3／2／1列と詳細ページ用フック

## Verification

- `npm test` がすべて成功する
- Worksカードが合計7枚、Coming Soonが6枚である
- Coming Soonにリンクや矢印がない
- `COSMO EFFECTS` カードから詳細ページへ到達できる
- 詳細ページからWorks、Profile、Contactへ戻れる
- ローカルの`href`と`src`がすべて解決できる
- 参考画像および新規ラスター画像をリポジトリへ追加していない
- 約 `1440×1000`、`900×1000`、`390×844` で3／2／1列を確認する
- キーボードフォーカス、横スクロールなし、コンソールエラーなしを確認する
- 通常モーション、動きを減らす設定、表示後のライブリサイズを確認する

## Out of scope

- 新しい実在作品の追加
- Coming Soonの詳細ページ
- CMS、JSON作品管理、ビルド工程
- 参考サイトの画像、ロゴ、文言、スタイルの複製
- 問い合わせフォーム、アクセス解析、作品動画のホスティング
