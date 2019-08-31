#include <stdio.h>
#include <time.h>

int main(int argc, char **argv){
	time_t timer;
	char buffer[26];
	struct tm *tm_info;
	char *result;

	time(&timer);
	tm_info = localtime(&timer);

	strftime(buffer, 26, "%Y-%m-%d %H:%M:%S", tm_info);

	printf("%s\n", buffer);

	return 0;
}