// 여러 className 조각 중 falsy 값을 걸러내고 합친다 (clsx 등 신규 의존성 추가 없이 최소 구현).
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
