import Stripe from 'stripe';

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_your_key_here',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_secret',
  plans: {
    basic: {
      priceId: process.env.STRIPE_BASIC_PRICE_ID || 'price_123_basic_test',
      name: 'Nexus Basic',
      amount: 30,
    },
    pro: {
      priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_456_pro_test',
      name: 'Nexus Pro',
      amount: 100,
    }
  }
};

export const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2023-10-16' as any,
});
