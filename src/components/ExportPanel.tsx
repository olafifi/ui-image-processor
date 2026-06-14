import { Icon } from './Icon';
import { resolveExportSize } from '../lib/canvasExport';
import type { ExportSettings, ImageQueueItem } from '../types';

interface ExportPanelProps {
  activeItem?: ImageQueueItem;
  error?: string;
  isBusy: boolean;
  itemCount: number;
  onApplyToAll: () => void;
  onExportCurrent: () => void;
  onExportZip: () => void;
  onOpenTemplate: () => void;
  onResetSize: () => void;
  onUpdateSettings: (settings: Partial<ExportSettings>) => void;
  status?: string;
}

export function ExportPanel({
  activeItem,
  error,
  isBusy,
  itemCount,
  onApplyToAll,
  onExportCurrent,
  onExportZip,
  onOpenTemplate,
  onResetSize,
  onUpdateSettings,
  status
}: ExportPanelProps) {
  const settings = activeItem?.exportSettings;
  const crop = activeItem?.crop;
  const sourceSize = activeItem
    ? {
        width: activeItem.naturalWidth || 1,
        height: activeItem.naturalHeight || 1
      }
    : { width: 1, height: 1 };
  const outputSize =
    settings && crop
      ? resolveExportSize(sourceSize, crop, settings)
      : {
          width: 0,
          height: 0
        };
  const cropSize =
    activeItem && crop
      ? {
          width: Math.max(1, Math.round(crop.width * sourceSize.width)),
          height: Math.max(1, Math.round(crop.height * sourceSize.height))
        }
      : {
          width: 0,
          height: 0
        };
  const formatLabel = settings?.backgroundType === 'solid' && settings.format === 'jpeg' ? 'JPG' : 'PNG';

  return (
    <aside className="panel">
      <div className="side-title">
        <span>裁剪模板与导出</span>
        <button className="ghost-button" type="button">
          收起
        </button>
      </div>

      <div className="field">
        <strong>当前图片</strong>
        {activeItem ? activeItem.originalName : '未导入图片'}
      </div>
      <div className="field">
        <strong>输出尺寸</strong>
        <span className="field-note">裁剪尺寸 {cropSize.width} x {cropSize.height}</span>
        <div className="inline-inputs">
          <label>
            <span>宽</span>
            <input
              aria-label="导出宽度"
              disabled={!settings}
              min={1}
              onChange={(event) => onUpdateSettings({ width: toPositiveInt(event.currentTarget.value, 1024) })}
              type="number"
              value={outputSize.width || 1024}
            />
          </label>
          <label>
            <span>高</span>
            <input
              aria-label="导出高度"
              disabled={!settings}
              min={1}
              onChange={(event) => onUpdateSettings({ height: toPositiveInt(event.currentTarget.value, 1024) })}
              type="number"
              value={outputSize.height || 1024}
            />
          </label>
        </div>
        <button
          className="mini-button"
          disabled={!settings || settings.sizeMode === 'crop'}
          onClick={onResetSize}
          type="button"
        >
          使用裁剪尺寸
        </button>
      </div>
      <div className="field">
        <strong>格式与背景</strong>
        <label className="stacked-control">
          <span>格式</span>
          <select
            aria-label="导出格式"
            disabled={!settings}
            onChange={(event) =>
              onUpdateSettings({
                backgroundType: event.currentTarget.value === 'jpeg' ? 'solid' : settings?.backgroundType,
                format: event.currentTarget.value as ExportSettings['format']
              })
            }
            value={settings?.format ?? 'png'}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPG</option>
          </select>
        </label>
        <label className="stacked-control">
          <span>背景</span>
          <select
            aria-label="导出背景"
            disabled={!settings}
            onChange={(event) =>
              onUpdateSettings({
                backgroundType: event.currentTarget.value as ExportSettings['backgroundType'],
                format: event.currentTarget.value === 'transparent' ? 'png' : settings?.format
              })
            }
            value={settings?.backgroundType ?? 'transparent'}
          >
            <option value="transparent">透明</option>
            <option value="solid">纯色</option>
          </select>
        </label>
        <label className="stacked-control">
          <span>颜色</span>
          <input
            aria-label="背景颜色"
            disabled={!settings || settings.backgroundType === 'transparent'}
            onChange={(event) => onUpdateSettings({ backgroundColor: event.currentTarget.value })}
            type="color"
            value={settings?.backgroundColor ?? '#ffffff'}
          />
        </label>
      </div>
      <div className="field">
        <strong>圆角</strong>
        <div className="range-row">
          <input
            aria-label="圆角半径"
            disabled={!settings}
            max={256}
            min={0}
            onChange={(event) => onUpdateSettings({ cornerRadius: toNonNegativeInt(event.currentTarget.value, 0) })}
            type="range"
            value={settings?.cornerRadius ?? 0}
          />
          <span>{settings?.cornerRadius ?? 0}px</span>
        </div>
      </div>
      <div className="field">
        <strong>批处理</strong>
        {itemCount} 张图片 · CSV 命名会在 ZIP 中生效
      </div>

      <div className="spacer" />
      {status && <div className="panel-status">{status}</div>}
      {error && <div className="panel-error">{error}</div>}
      <div className="export-group">
        <button onClick={onOpenTemplate} type="button">
          <Icon name="save" />
          保存/套用裁剪模板
        </button>
        <button disabled={!activeItem || itemCount < 2} onClick={onApplyToAll} type="button">
          <Icon name="template" />
          应用到全部
        </button>
        <button className="export-primary" disabled={!activeItem || isBusy} onClick={onExportCurrent} type="button">
          <Icon name="download" />
          导出当前 {formatLabel}
        </button>
        <button disabled={itemCount === 0 || isBusy} onClick={onExportZip} type="button">
          <Icon name="zip" />
          下载 ZIP
        </button>
      </div>
    </aside>
  );
}

function toPositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
}

function toNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}
