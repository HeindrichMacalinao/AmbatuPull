# Product and Customer UI States

## Empty Search State

**Purpose:** Explain when a customer or product search has no matching records.

**When it appears:** The search query is non-empty and the live API returns no records.

**Exact message:** `No customers/products found matching '[query]'. Clear search or add a new record.`

**Available actions:** Clear the search field. Use the appropriate Add Customer or Add Product action where permissions allow it.

**Role differences:** Admin and Superadmin users may add records. Regular Users receive add actions only when their existing permissions grant the matching add right.

## Empty Price History State

**Purpose:** Explain that a selected product has no available price records.

**When it appears:** The selected product's live price history contains no records.

**Exact message:** `No price records found for this product. Click '+ Add Price' to set an initial price.`

**Available actions:** Admin and Superadmin users may use Add Price. Regular Users have no Add Price control.

## Inline Form Validation

Missing required fields display visible field errors and prevent submission.

For non-positive unit prices, display `Unit price must be greater than zero.` and do not submit.

For duplicate effective dates, display the exact message:

`A price record already exists for this effective date.`

## Confirmation Dialogs

**Delete:** `Are you sure you want to delete this record? This action will deactivate the record.`

The record is soft-deleted and marked inactive rather than permanently removed.

**Restore:** `Are you sure you want to restore this record? It will become available again.`

Restore is available only to Admin and Superadmin users.
