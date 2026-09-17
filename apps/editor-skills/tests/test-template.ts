function fetchUser() {
	return { id: 1, name: 'Ada' };
}

/**
 * @agent:action:do
 * Rename fetchUser to getUser throughout this file.
 */

const currentUser = fetchUser();
console.log(currentUser);
