import React from 'react';
import { Entity } from 'draft-js';

export default ({ block }) => {
  const imgContent = Entity.get(block.getEntityAt(0)).getData()['preview'];
  return <img src={imgContent} />;
};
