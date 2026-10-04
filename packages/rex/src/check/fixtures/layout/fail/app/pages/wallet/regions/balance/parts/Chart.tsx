import styles from "./Chart.module.css";

export default function Chart() {
  return (
    <figure className={styles.chart}>
      <span role="button" tabIndex={0} className="size-[24px]">
        Zoom
      </span>
    </figure>
  );
}
