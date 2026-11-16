type Settings = Record<string, string | undefined>;

function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Thêm shippingDetails + hasMerchantReturnPolicy vào offers của sản phẩm,
// chỉ với những mục chủ shop đã khai báo trong Quản trị → Cài đặt → Giao hàng & đổi trả.
export function applyPolicySchema(schema: Record<string, unknown> | undefined, s: Settings): void {
  if (!schema) return;
  const offers = schema.offers as Record<string, unknown> | undefined;
  if (!offers) return;

  const fee = num(s.pol_ship_fee);
  if (fee !== null) {
    const details: Record<string, unknown> = {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: fee, currency: 'VND' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'VN' },
    };

    const min = num(s.pol_ship_min);
    const max = num(s.pol_ship_max);
    const handling = num(s.pol_handling_days);
    if (min !== null && max !== null) {
      const delivery: Record<string, unknown> = {
        '@type': 'ShippingDeliveryTime',
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: Math.min(min, max),
          maxValue: Math.max(min, max),
          unitCode: 'DAY',
        },
      };
      if (handling !== null) {
        delivery.handlingTime = {
          '@type': 'QuantitativeValue',
          minValue: 0,
          maxValue: handling,
          unitCode: 'DAY',
        };
      }
      details.deliveryTime = delivery;
    }
    offers.shippingDetails = details;
  }

  if (s.pol_return === 'none') {
    offers.hasMerchantReturnPolicy = {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'VN',
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    };
  } else if (s.pol_return === 'finite') {
    const days = num(s.pol_return_days);
    if (days !== null && days > 0) {
      offers.hasMerchantReturnPolicy = {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'VN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: Math.round(days),
        returnFees:
          s.pol_return_fee === 'customer'
            ? 'https://schema.org/ReturnShippingFees'
            : 'https://schema.org/FreeReturn',
      };
    }
  }
}