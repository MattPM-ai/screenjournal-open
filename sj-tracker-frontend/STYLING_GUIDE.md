# STYLING GUIDE - CRITICAL: DO NOT IGNORE

## ⚠️ IMPORTANT: This project uses a specific styling approach established in commit 494f347ca168835481b22005a6c622b04f888560

**DO NOT** convert inline styles to Tailwind classes or CSS modules. The styling approach is intentional and must be preserved.

## Styling Approach

### ✅ CORRECT: Inline Styles with CSS Variables

All page components and certain components use **inline styles with CSS variables** defined in `app/globals.css`.

**Example:**
```tsx
<div style={{ 
  minHeight: 'calc(100vh - 64px)', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  padding: 'var(--spacing-xl)', 
  backgroundColor: 'var(--bg-secondary)' 
}}>
```

### ❌ INCORRECT: Tailwind Classes

**DO NOT** use Tailwind classes like:
```tsx
// ❌ WRONG - DO NOT DO THIS
<div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-8 bg-[var(--bg-secondary)]">
```

### ❌ INCORRECT: CSS Modules for Pages

**DO NOT** convert page components to use CSS modules. Pages should use inline styles.

## Files That MUST Use Inline Styles

These files were converted in commit 494f347 and must remain using inline styles:

- `app/login/page.tsx`
- `app/profile/page.tsx`
- `app/register/page.tsx`
- `app/register/business/page.tsx`
- `app/register/user/page.tsx`
- `app/register/success/page.tsx`
- `components/UserMenu.tsx`

## Files That Use CSS Modules (OK)

These components use CSS modules and that's fine:

- `components/Chat.tsx` → `components/Chat.module.css`
- `components/NavBar.tsx` → `components/NavBar.module.css`
- `components/ReportDisplay.tsx` → `components/ReportDisplay.module.css`
- `components/ReportForm.tsx` → `components/ReportForm.module.css`
- `components/ReportLoading.tsx` → `components/ReportLoading.module.css`
- `components/GraphDisplay.tsx` → `components/GraphDisplay.module.css`
- `app/organisations/page.tsx` → `app/organisations/organisations.module.css`
- `app/users/page.tsx` → `app/users/users.module.css`

## CSS Variables Available

All CSS variables are defined in `app/globals.css`:

### Colors
- `var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-tertiary)`
- `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`
- `var(--border-color)`, `var(--border-hover)`
- `var(--accent-primary)`, `var(--accent-hover)`, `var(--accent-light)`

### Spacing
- `var(--spacing-xs)`, `var(--spacing-sm)`, `var(--spacing-md)`
- `var(--spacing-lg)`, `var(--spacing-xl)`, `var(--spacing-2xl)`

### Typography
- `var(--font-size-xs)`, `var(--font-size-sm)`, `var(--font-size-base)`
- `var(--font-size-lg)`, `var(--font-size-xl)`, `var(--font-size-2xl)`

### Border Radius
- `var(--radius-sm)`, `var(--radius-md)`, `var(--radius-lg)`
- `var(--radius-xl)`, `var(--radius-full)`

### Shadows
- `var(--shadow-sm)`, `var(--shadow-md)`, `var(--shadow-lg)`

### Transitions
- `var(--transition-fast)`, `var(--transition-base)`, `var(--transition-slow)`

## Tailwind Configuration

Tailwind v4 is installed and configured via `@import "tailwindcss"` in `app/globals.css`, but it is **NOT** used for className attributes in page components. It's available for utility purposes but the primary styling approach is inline styles with CSS variables.

## Common Patterns

### Buttons
```tsx
<button
  style={{ 
    width: '100%', 
    padding: 'var(--spacing-md)', 
    background: 'var(--accent-primary)', 
    color: 'white', 
    border: 'none', 
    borderRadius: 'var(--radius-md)', 
    fontSize: 'var(--font-size-base)', 
    fontWeight: 600, 
    cursor: 'pointer', 
    transition: 'background-color var(--transition-base), transform var(--transition-fast)'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = 'var(--accent-hover)';
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = 'var(--accent-primary)';
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = 'none';
  }}
>
  Button Text
</button>
```

### Input Fields
```tsx
<input
  style={{ 
    width: '100%', 
    padding: 'var(--spacing-md)', 
    border: '2px solid var(--border-color)', 
    borderRadius: 'var(--radius-md)', 
    fontSize: 'var(--font-size-base)', 
    transition: 'border-color var(--transition-base)', 
    background: 'var(--bg-primary)', 
    color: 'var(--text-primary)',
    fontFamily: 'inherit'
  }}
  onFocus={(e) => {
    e.target.style.outline = 'none';
    e.target.style.borderColor = 'var(--accent-primary)';
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';
  }}
  onBlur={(e) => {
    e.target.style.borderColor = 'var(--border-color)';
    e.target.style.boxShadow = 'none';
  }}
/>
```

### Cards/Containers
```tsx
<div style={{ 
  background: 'var(--bg-primary)', 
  borderRadius: 'var(--radius-xl)', 
  boxShadow: 'var(--shadow-lg)', 
  padding: 'var(--spacing-xl)', 
  border: '1px solid var(--border-color)' 
}}>
```

## When Making Changes

1. **NEVER** convert inline styles to Tailwind classes in the files listed above
2. **NEVER** create CSS modules for page components
3. **ALWAYS** use CSS variables from `app/globals.css`
4. **ALWAYS** maintain the same styling patterns as existing code
5. **ALWAYS** use inline styles with CSS variables for page components

## Why This Approach?

This approach was established in commit 494f347 to:
- Maintain consistency with CSS variables
- Avoid Tailwind class conflicts
- Keep styling co-located with components
- Ensure all styling uses the same design system variables

## Reference Commit

See commit `494f347ca168835481b22005a6c622b04f888560` for the exact styling approach that must be preserved.

