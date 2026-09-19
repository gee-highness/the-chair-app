// src/components/ui/Ticket.tsx
import { HTMLAttributes, ReactNode } from 'react';
import styles from './Ticket.module.css';

interface TicketProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  stamped?: boolean; // offset-background emphasis instead of a drop shadow
  as?: 'div' | 'article' | 'li';
}

export function Ticket({ children, stamped, as = 'div', className, ...rest }: TicketProps) {
  const Comp = as as any;
  return (
    <div className={styles.wrap}>
      {stamped && <div className={styles.stamp} aria-hidden="true" />}
      <Comp className={[styles.ticket, stamped ? styles.ticketStamped : '', className || ''].filter(Boolean).join(' ')} {...rest}>
        <span className={styles.hole} aria-hidden="true" data-side="left" />
        <span className={styles.hole} aria-hidden="true" data-side="right" />
        {children}
      </Comp>
    </div>
  );
}
