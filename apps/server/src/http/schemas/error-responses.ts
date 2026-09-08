import { apiErrorSchema } from '@porcelain/contracts/api-error';

export const errorResponses = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  404: apiErrorSchema,
  422: apiErrorSchema,
  503: apiErrorSchema,
  500: apiErrorSchema,
};
