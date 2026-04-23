<template>
  <div class="card">
    <section>
      <h2>Demo</h2>
      <div class="video-wrapper">
        <video src="/demo.mp4" controls width="100%"></video>
      </div>
    </section>

    <section>
      <h2>注意事項</h2>

      <div class="note">
        <h3>YouTube 無法自動下載</h3>
        <p>
          由於 YouTube 限制，因此網站目前無法提供 YouTube
          轉換功能，請改用頁面上提供的外部頁面手動下載 mp3，再另外上傳。
        </p>
      </div>

      <div class="note">
        <h3>分軌完成後請盡快下載</h3>
        <p>
          分軌結果不會永久保留。若要再次使用分軌，請點「下載分軌」存到本機，下次便可直接匯入分軌。
        </p>
      </div>

      <div class="note">
        <h3>可匯入來源</h3>
        <p>目前提供自動轉換的平台：</p>
        <ul>
          <li>SoundCloud</li>
          <li>StreetVoice</li>
        </ul>
        <p>也可以直接上傳本機音檔（mp3 / wav 等）。</p>
      </div>

      <div class="note">
        <h3>建議用電腦操作</h3>
        <p>在手機瀏覽器下，部分功能（移調、分軌播放）可能有問題。</p>
      </div>

      <div class="note">
        <h3>請勿濫用分軌功能</h3>
        <p>每次分軌都會呼叫付費 API，請合理使用，感謝。</p>
      </div>

      <div class="note">
        <h3>問題回報</h3>
        <p class="feedback-text">有任何 bug 或回饋，歡迎透過以下方式回報：</p>
        <ul class="feedback-links">
          <li>
            <a :href="GITHUB_REPO" target="_blank" rel="noopener">GitHub Issues</a>
          </li>
          <li>
            <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { GITHUB_REPO, EMAIL } from '../constants'
</script>

<style scoped>
h2 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

h3 {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 24px;
}

.video-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg);

  iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
}

.note {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note p,
.note ul {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
}

.note ul {
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feedback-text {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
}

.feedback-links {
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;

  a {
    color: var(--text-muted);
    text-decoration: underline;
    text-underline-offset: 3px;

    &:hover {
      color: var(--text);
    }
  }
}
</style>
