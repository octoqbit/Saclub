import React from 'react';
import blueRobot from '../avatars/blue-robo.svg';
import pinkRobot from '../avatars/pink-robo.svg';

export function RobotAvatar({ variant = 'boy', decorative = false }) {
  const isPink = variant === 'girl';
  return <img
    className="robot-avatar"
    src={isPink ? pinkRobot : blueRobot}
    alt={decorative ? '' : `${isPink ? 'Pink' : 'Blue'} robot avatar`}
    width="96"
    height="96"
    draggable="false"
  />;
}
