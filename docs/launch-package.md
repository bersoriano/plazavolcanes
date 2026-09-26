# Plaza Volcanes · launch package

**Status:** current direction, 2026-09-27. Replaces every earlier seller package: the "first 100 stores in three months" promotion, "Premium for 1 year", and the 15/40/100 listing ladder as a launch cap.

**One sentence, used everywhere a seller reads about the offer:**

> **Primeras 100 tiendas: 50 productos, insignia fundadora y 0% comisión fija 12 meses. Todas las demás: 25 productos gratis.**

---

## 1. The package

### Everyone
- 1 shop.
- 25 live listings.
- $0 to publish. No listing fee.
- Direct payment: the customer pays the seller; Plaza Volcanes doesn't process, retain or refund the money.

### Tiendas fundadoras (the first 100 that earn it)
**How a shop earns a seat:** it publishes **at least 8 live items within 7 days** of opening. Registering isn't enough. Seats go in the order shops reach 8 items, until 100 are taken. Founder status is earned with inventory, not with an email: otherwise the plaza fills with 100 empty shops.

What a founder gets:

| Perk | Duration |
|---|---|
| 50 live listings | Permanent (locked) |
| "Tienda fundadora" badge | Permanent |
| Founder theme: a distinct frame and the gold/black chip already used on cards | Permanent |
| Homepage and category rotation | 90 days from earning the seat |
| 0% commission, locked | 12 months from earning the seat |
| Early access to new seller tools (analytics, bulk edit, reputation import) | As they ship |

### After seat 100
Still 25 free listings and still $0 to publish. The founders offer leaves every page the moment the last seat is taken.

---

## 2. Commission policy (decide now, write into the terms)

The site must never say "0% forever" and "0% for 100 shops" on the same screen. The policy:

1. **Direct payment, every shop: 0% commission today.** Plaza Volcanes doesn't touch the money, so it has nothing to charge on. Copy says "sin comisión en pago directo", never "para siempre".
2. **Founders: 0% locked for 12 months** on anything the plaza charges, including any future paid service. This is the one guarantee on the page.
3. **From month 13**, founders move to the general policy published in the *Términos para vendedores*. Any change to that policy is published there before it applies.
4. **Future, optional:** *pago protegido*. The seller opts in and the plaza takes 3–5% only on those orders. Direct payment stays the default, which keeps the "quédate con todo" story intact.

**Action for the owner and counsel:** write points 1–3 into the *Términos para vendedores* before launch. The legal documents are versioned and approved outside the codebase, so the site links to the terms and doesn't restate them.

---

## 3. Listing slots and levels

**Don't gate listing slots on performance at launch.** A ladder that starts at 15 punishes exactly the seller the plaza needs: someone moving a Facebook album. Gate visibility and tools, not catalog size. 25 against 50 is enough of a wedge; 15 is too tight, and unlimited brings junk.

- **At launch:** 25 live listings for everyone, 50 for founders. The trust tiers (Estándar, Confiable, Mejor valorada) keep being calculated and shown as a quality signal. They don't change the cap.
- **Planned ladder, once there is real volume** (not promised on the site):
  - Everyone: 25 live.
  - Fundadora: 50 live, locked.
  - Confiable (after N completed orders plus response time): 80 live and better placement.
  - Mejor valorada: 150+ and the public trust badge.
  - Extra slots later as a paid or earned upgrade.

---

## 4. "Premium"

Don't call anything Premium until it does something a seller can feel in week one. Founders get **status** (badge and theme), not a "Premium" label. The existing admin-granted Premium distinction stays as it is.

**Ships with the first 100**
- Founder badge and theme (status, not a tool).
- Shop analytics: views, saves, inquiry rate, response time, and items that get opened and die.
- Featured slot in their category.
- CSV or URL assist to pull titles and photos from an existing ML or Facebook listing, even if it's done by hand at first.

**Next**
- Price suggestions from comparable sold and listed items.
- Saved-search alerts, so buyers come back.
- Bulk publish and drafts.
- Optional *pago protegido* (section 2).
- Promoted placement: paid, optional, and never required to be visible at all.

Analytics and advanced sales tools are the right Premium direction later. They aren't why someone joins on day one: status, extra slots, homepage placement and "me quedo con el 100%" are.

---

## 5. Page rules (home and /vender)

1. **One founder sentence**, repeated everywhere (above).
2. **No 15/40/100 as a launch cap.** Levels read as a quality signal today and as future benefits.
3. **No broken images and no empty category chips:** show only what has something behind it.
4. **A live counter and 6–8 real shops.** Two shops says "prototype".
5. **A comparison on /vender:** Plaza vs Mercado Libre vs Facebook Marketplace vs eBay, on commission, retention, permanent shop, payment, reputation and written orders. It sticks to each platform's public policy, dated, and gets legal review before launch (comparative advertising).
6. **Honest about reputation:** "Muestras tu perfil de ML/FB en tu tienda" is honest. "Tus estrellas viajan" is a claim the plaza would have to back.
7. **The objection FAQ sellers actually have:** who the buyers are, a buyer who disappears, a scam listing, month 13, deleting and leaving.
8. **"Cómo funciona" is a seller path, not a second homepage:** nombre → estado → primer producto → 8 productos en 7 días.
9. **Pick a commission policy** (section 2) and say only that.

---

## 6. Implementation notes

- **Seats:** `private.founding_shops` holds one row per seat, claimed by the database when a shop's 8th published product lands within 7 days of opening. Seats never return to the pool. `shops.founder_since` caches the claim for public reads.
- **Limits:** `shops.listing_limit` is 25, or 50 for founders. The trust evaluator still writes tiers, but the launch policy sets the cap.
- **Window:** `private.founders_program` holds the cap (100), the rule (8 items in 7 days), the perk durations, and an optional closing date.
- **Approval:** a new shop needs admin approval before its items show. Its 7 days count from opening, so reviews must happen within a day during launch, or founders lose part of their window.

## 7. Open items

- Commission policy into the *Términos para vendedores* (section 2), with counsel.
- The /vender comparison table, reviewed by counsel before launch.
- Category rotation for founders (homepage rotation ships first).
- Analytics, featured category slot and the CSV/URL assist: not built yet. The site promises them only as "acceso anticipado".
