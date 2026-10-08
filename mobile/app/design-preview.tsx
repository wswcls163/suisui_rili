import React from 'react';
import { DesignPreviewHome } from '../src/components/design-preview/DesignPreviewHome';
import { todayInBeijing } from '../src/core/dates';

const previewToday = todayInBeijing(Date.now());

export default function DesignPreviewRoute() {
  return <DesignPreviewHome today={previewToday} />;
}
