import styles from "./Card.module.css";

export interface CardProps {
  readonly title: string;
}

export default function Card({ title }: CardProps) {
  return (
    <div className={`${styles.card} ${styles["text-red-600"]} rounded-lg`}>
      <h2 className={styles.title}>{title}</h2>
    </div>
  );
}
