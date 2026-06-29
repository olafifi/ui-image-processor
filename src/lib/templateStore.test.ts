import { describe, expect, it } from 'vitest';
import { createMemoryTemplateStore } from './templateStore';

describe('template store', () => {
  it('saves and lists templates', async () => {
    const store = createMemoryTemplateStore();

    await store.save({
      name: '透明 UI 参考',
      crop: {
        ratio: '1:1',
        x: 0,
        y: 0,
        width: 1,
        height: 1
      },
      exportSettings: {
        format: 'png',
        sizeMode: 'custom',
        width: 1024,
        height: 1024,
        backgroundType: 'transparent',
        backgroundColor: '#ffffff',
        cornerRadius: 24,
        compressionMode: 'source-size',
        jpegQuality: 88
      },
      namingRule: 'ui_ref_{n}'
    });

    expect((await store.list())[0].name).toBe('透明 UI 参考');
  });
});
