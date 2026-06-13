const sampleImages = ['hero_ref_01.jpg', 'icon_raw.png', 'button_ref.webp'];

export function ImageQueue() {
  return (
    <aside className="rail" aria-label="图片队列">
      <div className="side-title">
        <span>队列</span>
        <span>{sampleImages.length}</span>
      </div>

      {sampleImages.map((name, index) => (
        <button className={index === 0 ? 'thumb active' : 'thumb'} key={name} type="button">
          {name}
        </button>
      ))}

      <div className="spacer" />
      <div className="drop-hint">拖入多张图片</div>
    </aside>
  );
}
