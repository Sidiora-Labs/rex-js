import styles from "./Chart.module.css";

export default function Chart() {
  return (
    <figure className={styles.chart}>
      <span role="button" tabIndex={0} className="size-11">
        Zoom
      </span>
    </figure>
  );
}
