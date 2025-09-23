<?php
$files = glob("*.html");
foreach($files as $file) {
    echo "<li><a href='$file' target='_blank'>$file</a></li>";
}
?>