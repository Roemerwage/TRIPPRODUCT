import type React from 'react';

export type MinigameDefinition = {
  id: string;
  titel: string;
  beschrijving: string;
  route: string;
  component?: React.ComponentType<any>;
  icon?: React.ReactNode;
  assets?: string[];
};
