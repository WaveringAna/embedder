describe("The Home Page", () => {
	beforeEach(() => {
	});

	it("successfully loads", () => {
		cy.visit("/");
	});

	it("sets auth cookie when logging in via form submission", () => {
		const username = "admin";
		const password = "changeme";

		cy.visit("/login");

		cy.get("input[name=username]").type(username);
		cy.get("input[name=password]").type(`${password}{enter}`);

		cy.url().should("include", "/");

		cy.getCookie("connect.sid").should("exist");

		cy.get("li").contains("admin");
	});

	it("fails to log in with wrong password", () => {
		const username = "admin";
		const password = "wrongpassword";

		cy.visit("/login");

		cy.get("input[name=username]").type(username);
		cy.get("input[name=password]").type(`${password}{enter}`);

		cy.url().should("include", "/login");

		cy.getCookie("connect.sid").should("not.exist");
	});

	it("logs out", () => {
		const username = "admin";
		const password = "changeme";

		cy.visit("/login");

		cy.get("input[name=username]").type(username);
		cy.get("input[name=password]").type(`${password}{enter}`);

		cy.url().should("include", "/");

		cy.getCookie("connect.sid").should("exist");

		cy.get("li").contains("admin");

		cy.get("button").contains("Sign out").click();

		cy.get("a").contains("Sign in");
	});
});

describe("The Upload Page", () => {
	beforeEach(() => {
		cy.request("POST", "/login/password", {
			username: "admin",
			password: "changeme"
		});
	});

	it("successfully loads", () => {
		cy.visit("/");

		cy.getCookie("connect.sid").should("exist");

		cy.get("li").contains("admin");
	});

	it("successfully uploads a file", () => {
		cy.visit("/");

		cy.getCookie("connect.sid").should("exist");

		cy.get("li").contains("admin");

		cy.get("input[type=file]").attachFile("test.png");

		cy.get("input[type=button][value=Upload]").click();

		cy.url().should("include", "/");

		cy.get("img").should("exist");
	});

	it("successfully deletes a file", () => {
		cy.visit("/");

		cy.getCookie("connect.sid").should("exist");

		cy.get("li").contains("admin");

		cy.get("input[type=button][value=Upload]").click();

		cy.url().should("include", "/");

		cy.get("img").should("exist");

		cy.get("img").realHover();

		cy.get("button[class=destroy]").click();

		cy.url().should("include", "/");

		cy.get("img").should("not.exist");
	});

	it("file successfully expires", () => {
		cy.visit("/");

		cy.getCookie("connect.sid").should("exist");

		cy.get("li").contains("admin");

		cy.get("input[type=file]").attachFile("test.png");

		cy.get("select").select("1 minute");

		cy.get("input[type=button][value=Upload]").click();

		cy.url().should("include", "/");

		cy.get("img").should("exist");

		cy.wait(120000); //2 minutes

		cy.reload();

		cy.get("img").should("not.exist");
	});

	it("ShareX successfully uploads a file", () => {
		cy.fixture("test.png", "base64")
			.then((file) => Cypress.Blob.base64StringToBlob(file))
			.then((blob) => {
				let formdata = new FormData();
				formdata.append("fileupload", blob, "test.png");

				cy.request({
					url: "/sharex",
					method: "POST",
					headers: {
						"Content-Type": "multipart/form-data",
						"key": "pleaseSetAPI_KEY"
					},
					body: formdata
				}).its('status').should('be.equal', 200);
			});

		cy.visit("/");

		cy.getCookie("connect.sid").should("exist");

		cy.get("li").contains("admin");

		cy.get("img").should("exist");

	});
});