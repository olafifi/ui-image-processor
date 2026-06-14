import type { ReactElement, SVGProps } from 'react';

type IconName =
  | 'upload'
  | 'template'
  | 'rename'
  | 'sparkles'
  | 'selectAdd'
  | 'selectSubtract'
  | 'eraser'
  | 'brush'
  | 'crop'
  | 'undo'
  | 'redo'
  | 'corner'
  | 'transparent'
  | 'save'
  | 'download'
  | 'zip'
  | 'close';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      {paths[name]}
    </svg>
  );
}

const paths: Record<IconName, ReactElement> = {
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  template: (
    <>
      <path d="M7 7h10v10H7z" />
      <path d="M4 4h10v10H4z" />
      <path d="M10 10h10v10H10z" />
    </>
  ),
  rename: (
    <>
      <path d="M4 7h10" />
      <path d="M4 12h16" />
      <path d="M4 17h8" />
      <path d="M17 6v12" />
      <path d="M14 9l3-3 3 3" />
      <path d="M14 15l3 3 3-3" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      <path d="M5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z" />
    </>
  ),
  selectAdd: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
      <path d="M16 16l4 4" />
    </>
  ),
  selectSubtract: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M8 11h6" />
      <path d="M16 16l4 4" />
    </>
  ),
  eraser: (
    <>
      <path d="M4 15l9-9 7 7-6 6H8z" />
      <path d="M10 21h10" />
      <path d="M12 8l7 7" />
    </>
  ),
  brush: (
    <>
      <path d="M14 4l6 6" />
      <path d="M4 20c3 0 5-1 6-3l8-8-3-3-8 8c-2 1-3 3-3 6z" />
      <path d="M7 17l3 3" />
    </>
  ),
  crop: (
    <>
      <path d="M6 3v12h12" />
      <path d="M3 6h12v12" />
      <path d="M18 15v6" />
      <path d="M15 18h6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7H4v5" />
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.7" />
    </>
  ),
  redo: (
    <>
      <path d="M15 7h5v5" />
      <path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.7" />
    </>
  ),
  corner: <path d="M5 19V9a4 4 0 0 1 4-4h10" />,
  transparent: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 12h16" />
      <path d="M12 4v16" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h12l2 2v14H5z" />
      <path d="M8 4v6h8V4" />
      <path d="M8 17h8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  zip: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v4h4" />
      <path d="M10 7h2" />
      <path d="M10 10h2" />
      <path d="M10 13h2" />
      <path d="M9 17h4" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  )
};
