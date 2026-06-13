import { Icon } from './Icon';
import { ToolBar } from './ToolBar';

const cropRatios = ['1:1', '4:3', '3:4', '16:9', '9:16', '自由'];

export function EditorCanvas() {
  return (
    <main className="center">
      <ToolBar />

      <section className="stage" aria-label="图片编辑画布">
        <div className="drop-overlay">可直接拖入单张或多张图片</div>
        <div className="canvas">大画布 / 裁剪框 / mask 预览</div>
      </section>

      <div className="cropbar">
        {cropRatios.map((ratio) => (
          <button key={ratio} type="button">
            {ratio}
          </button>
        ))}
        <button type="button">
          <Icon name="corner" />
          圆角
        </button>
        <button type="button">
          <Icon name="transparent" />
          透明背景
        </button>
        <span className="summary">导出：PNG · 1024 x 1024</span>
      </div>
    </main>
  );
}
