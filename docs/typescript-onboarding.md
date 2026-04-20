# TypeScript Onboarding for JavaScript Developers

## Key Concepts
- Type annotations: `let x: number = 5;`
- Interfaces and types for objects and functions
- Use `any` only as a last resort
- Use `as` for type assertions, but prefer explicit types

## Common Patterns
- Function signatures: `function foo(bar: string): number { ... }`
- Generics: `function identity<T>(x: T): T { return x; }`
- Type narrowing: `if (typeof x === 'string') { ... }`

## Project Practices
- All new code must be typed
- Use interfaces for public APIs, types for internal structures
- Prefer union types over enums
- Use `unknown` for untrusted input, then narrow

## Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Type Challenges](https://github.com/type-challenges/type-challenges)
- [Effective TypeScript](https://effectivetypescript.com/)

## Getting Help
- Ask in Discussions or open a draft PR for review
- See `/docs/architecture.md` for system overview
