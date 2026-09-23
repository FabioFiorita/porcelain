import { apiErrorSchema } from '@porcelain/contracts/access';

export const errorResponses = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
  413: apiErrorSchema,
  422: apiErrorSchema,
  429: apiErrorSchema,
  503: apiErrorSchema,
  500: apiErrorSchema,
};
