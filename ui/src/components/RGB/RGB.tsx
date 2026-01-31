import type { RGB as RGBType } from '@tma.js/sdk-react';
import type { FC } from 'react';
import type { HTMLAttributes } from 'react';

import { bem } from '@/css/bem';
import { classNames } from '@/css/classnames';

import './RGB.css';

const [b, e] = bem('rgb');

export type RGBProps = HTMLAttributes<HTMLSpanElement> & {
  color: RGBType;
};

export const RGB: FC<RGBProps> = ({ color, className, ...rest }) => (
  <span {...rest} className={classNames(b(), className)}>
    <i className={e('icon')} style={{ backgroundColor: color }} />
    {color}
  </span>
);
