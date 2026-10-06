import React from 'react';
import { techEmojis, memberEmoji } from './profile-options.mjs';

export function RobotAvatar({ variant = 'robot', role = 'member', pronouns, decorative = false }) {
  const isAdmin = role === 'admin';
  const isSheHer = pronouns === 'she/her' || (!pronouns && variant === 'girl');
  const [, emoji, label] = techEmojis.find(([id]) => id === memberEmoji(variant));
  return <span
    className="tech-emoji"
    role={decorative ? undefined : 'img'}
    aria-hidden={decorative ? true : undefined}
    aria-label={decorative ? undefined : isAdmin ? 'Administrator technologist' : label}
  >{isAdmin ? (isSheHer ? '👩‍💻' : '👨‍💻') : emoji}</span>;
}
