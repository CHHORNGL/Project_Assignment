import React, { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    description: "Great for individual farmers and small family plots getting started with disease diagnosis",
    price: 0,
    yearlyPrice: 0,
    buttonText: "Active Plan",
    buttonVariant: "current",
    popular: false,
    includes: [
      "Includes:",
      "Up to 10 crop diagnoses / month",
      "Standard AI rule engine",
      "Khmer lunar seasonal calendar",
      "Community Q&A access",
    ],
  },
  {
    name: "Pro Farmer",
    description: "Best value for active producers needing unlimited AI power, weather warnings, and direct expert chat",
    price: 20,
    yearlyPrice: 192,
    buttonText: "Upgrade to Pro",
    buttonVariant: "default",
    popular: true,
    includes: [
      "Everything in Starter, plus:",
      "Unlimited GPT-4o Vision diagnoses",
      "Ultra-Advanced Weather Intelligence & alerts",
      "Direct 24/7 Chat with certified Agronomists",
      "Permanent cloud history & PDF reports",
      "Zero queue waiting with VIP inference",
    ],
  },
  {
    name: "Commercial Farm",
    description: "Advanced plan for agricultural cooperatives, large plantations, and multi-field management teams",
    price: 48,
    yearlyPrice: 456,
    buttonText: "Contact Sales",
    buttonVariant: "outline",
    popular: false,
    includes: [
      "Everything in Pro, plus:",
      "Multi-user farm & worker permissions",
      "Custom pest & pathogen rule modeling",
      "Dedicated agronomist advisor via Phone/Video",
      "Bulk diagnosis data export & API access",
    ],
  },
];

export default function PricingSection3() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="px-4 pt-12 pb-20 max-w-7xl mx-auto relative">
      <article className="flex sm:flex-row flex-col sm:items-center items-start justify-between mb-8 gap-4">
        <div className="text-left">
          <h2 className="text-4xl font-bold leading-tight text-neutral-900 dark:text-neutral-50 mb-2">
            Plans &amp; Pricing
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-xl">
            Trusted by thousands of farmers. Unlock precision agricultural AI tools, weather intelligence, and certified expert guidance.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="relative z-10 flex w-fit rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={cn(
                "relative z-10 cursor-pointer h-10 rounded-full px-5 py-1 text-sm font-semibold transition-colors",
                !isYearly
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
              )}
            >
              Monthly
            </button>

            <button
              onClick={() => setIsYearly(true)}
              className={cn(
                "relative z-10 cursor-pointer h-10 rounded-full px-5 py-1 text-sm font-semibold transition-colors flex items-center gap-2",
                isYearly
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
              )}
            >
              Yearly
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </article>

      <div className="grid md:grid-cols-3 gap-6 bg-gradient-to-b from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-800 p-4 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "relative flex flex-col justify-between rounded-2xl p-6 transition-transform duration-200",
              plan.popular
                ? "bg-gradient-to-b from-neutral-900 to-black text-white border-2 border-neutral-700 shadow-2xl md:scale-105"
                : "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 shadow-sm"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-700 border border-neutral-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow">
                Popular &bull; Recommended
              </div>
            )}

            <CardContent className="p-0">
              <div className="space-y-2 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    ${isYearly ? plan.yearlyPrice : plan.price}
                  </span>
                  <span className={cn("text-sm font-medium", plan.popular ? "text-neutral-300" : "text-neutral-500")}>
                    /{isYearly ? "year" : "month"}
                  </span>
                </div>

                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className={cn("text-sm leading-relaxed min-h-[40px]", plan.popular ? "text-neutral-300" : "text-neutral-600 dark:text-neutral-400")}>
                  {plan.description}
                </p>
              </div>

              <div className={cn("space-y-3 pt-4 border-t", plan.popular ? "border-neutral-800" : "border-neutral-200 dark:border-neutral-800")}>
                <h4 className={cn("text-xs font-bold uppercase tracking-wider", plan.popular ? "text-neutral-200" : "text-neutral-900 dark:text-neutral-100")}>
                  {plan.includes[0]}
                </h4>
                <ul className="space-y-2.5 text-sm font-medium">
                  {plan.includes.slice(1).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2.5">
                      <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0", plan.popular ? "bg-neutral-800 border border-neutral-700 text-white" : "bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100")}>
                        ✓
                      </span>
                      <span className={plan.popular ? "text-neutral-200" : "text-neutral-700 dark:text-neutral-300"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="p-0 mt-6">
              <button
                className={cn(
                  "w-full h-12 rounded-xl text-base font-semibold transition-all duration-200",
                  plan.popular
                    ? "bg-gradient-to-t from-neutral-100 to-neutral-300 text-neutral-950 shadow-lg shadow-neutral-900/50 hover:brightness-105"
                    : plan.buttonVariant === "current"
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 cursor-default"
                      : "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 shadow"
                )}
              >
                {plan.buttonText}
              </button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
