import type { CompensationPackage } from './useCompensationStore'

export function convertPackageToCad(
  pkg: CompensationPackage,
  fxRate: number,
  enabled: boolean,
): CompensationPackage {
  if (!enabled || !Number.isFinite(fxRate) || fxRate <= 0) {
    return pkg
  }

  return {
    ...pkg,
    companyCurrentPrice: pkg.companyCurrentPrice * fxRate,
    esppLockedInPrice: pkg.esppLockedInPrice * fxRate,
    rsuGrants: pkg.rsuGrants.map((grant) => ({
      ...grant,
      grantPrice: grant.grantPrice * fxRate,
    })),
  }
}
