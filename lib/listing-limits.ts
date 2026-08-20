export function hasListingCapacity(publishedCount: number, listingLimit: number) {
  return publishedCount < listingLimit;
}
