require('./test-helper');
const assert = require('assert');
const database = require('../src/database');

describe("database", () => {
  beforeEach(async () => {
    await database.clear();
  })

  describe(".createBusiness", () => {
    it("allows the business to be retrieved later", async () => {
      const id = await database.createBusiness({
        googleId: '5',
        name: "Solae's Lounge",
        address: '123 alberta',
        phone: '123-456-7890',
        latitude: 37.76,
        longitude: -122.42
      });

      const business = await database.getBusinessById(id);

      assert.deepEqual(business, {
        id,
        googleId: '5',
        name: "Solae's Lounge",
        address: '123 alberta',
        phone: '123-456-7890',
        tags: [],
        latitude: 37.76,
        longitude: -122.42,
        categories: [],
        overallRating: null,
        reviewCount: 0,
        fatAverageRating: null,
        fatRatingCount: 0,
        transAverageRating: null,
        transRatingCount: 0,
        disabledAverageRating: null,
        disabledRatingCount: 0,
        pocAverageRating: null,
        pocRatingCount: 0,
      })

      assert.deepEqual(await database.getBusinessByGoogleId('5'), business)
    });
  });

  describe(".getBusinessesByGoogleIds", () => {
    it("retrieves the businesses with the given google ids", async () => {
      const ids = [
        await database.createBusiness({
          googleId: '101',
          name: "Business 1",
          latitude: 37.76,
          longitude: -122.42
        }),
        await database.createBusiness({
          googleId: '102',
          name: "Business 2",
          latitude: 37.76,
          longitude: -122.42
        }),
        await database.createBusiness({
          googleId: '103',
          name: "Business 3",
          latitude: 37.76,
          longitude: -122.42
        }),
      ]

      const businesses = await database.getBusinessesByGoogleIds(['101', '103'])
      assert.deepEqual(businesses.map(business => business.name).sort(), [
        'Business 1',
        'Business 3'
      ])
    });
  });

  describe(".createReview", () => {
    let userId, businessId

    beforeEach(async () => {
      userId = await database.createUser({
        facebookId: '567',
        name: 'Bob Carlson',
        email: 'bob@example.com'
      })

      businessId = await database.createBusiness({
        googleId: "dr-brain",
        name: 'Dr Brain',
        address: '123 Main St',
        phone: '555-555-5555',
        latitude: 37.767423217936834,
        longitude: -122.42821739746094
      })
    });

    it("creates a review and updates the business's score and categories", async () => {
      await database.createReview(userId, businessId, {
        content: "I love this person deeply.",
        fatRating: 5,
        transRating: 5,
        disabledRating: 5,
        pocRating: 4,
        categories: ['Doctors']
      });

      let business = await database.getBusinessById(businessId);
      assert.equal(business.fatAverageRating, 5);
      assert.equal(business.pocAverageRating, 4);

      assert.deepEqual(business.categories, ['Doctors']);

      await database.createReview(userId, businessId, {
        content: "I hate.",
        fatRating: 1,
        transRating: 3,
        disabledRating: 1,
        pocRating: 2,
        categories: ['Doctors', 'Internal Medicine']
      });

      business = await database.getBusinessById(businessId);
      assert.equal(business.fatAverageRating, 3);
      assert.equal(business.pocAverageRating, 3);

      assert.deepEqual(business.categories, ['Doctors', 'Internal Medicine']);

      await database.createReview(userId, businessId, {
        content: "I pretty much love this person.",
        fatRating: 5,
        transRating: 2,
        disabledRating: 2,
        pocRating: 3,
        categories: ['Doctors']
      });

      business = await database.getBusinessById(businessId);
      assert.equal(business.fatAverageRating, 3.7)
      assert.equal(business.pocAverageRating, 3)
      assert.deepEqual(business.categories, ['Doctors', 'Internal Medicine']);

      const reviews = await database.getBusinessReviewsById(businessId);

      assert.deepEqual(reviews.map(review => review.content).sort(), [
        'I hate.',
        'I love this person deeply.',
        'I pretty much love this person.'
      ]);

      assert.deepEqual(reviews.map(review => review.categories).sort(), [
        ['Doctors'],
        ['Doctors'],
        ['Doctors', 'Internal Medicine'],
      ]);

      assert.deepEqual(reviews[0].user, {
        name: 'Bob Carlson',
        id: userId
      })

      assert.deepEqual(reviews.map(review => review.fatRating).sort(), [1, 5, 5]);
      assert.deepEqual(reviews.map(review => review.pocRating).sort(), [2, 3, 4]);
    });

    it("doesn't allow unknown categories", async () => {
      try {
        await database.createReview(userId, businessId, {
          content: "I love this person deeply.",
          fatRating: 5,
          transRating: 5,
          categories: ['Rodeo Clowns']
        });
      } catch (error) {
        assert.equal(error.message, "Invalid category 'Rodeo Clowns'");
      }

      const business = await database.getBusinessById(businessId);
      assert.deepEqual(business.categories, []);
      assert.deepEqual(await database.getBusinessReviewsById(businessId), []);
    });

    it("allows adding tags to businesses", async () => {
      const userId2 = await database.createUser({
        facebookId: '5678',
        name: 'Todd Carlson',
        email: 'todd@example.com'
      });

      const reviewId1 = await database.createReview(userId, businessId, {
        content: "I love this doctor deeply.",
        disabledRating: 4,
        categories: ['Doctors'],
        tags: ['wheelchair-accessible', 'cool']
      });

      await database.createReview(userId2, businessId, {
        content: "Great doctor.",
        disabledRating: 4,
        categories: ['Doctors'],
        tags: ['wheelchair-accessible', 'kind']
      });

      let business = await database.getBusinessById(businessId);
      assert.deepEqual(business.tags, []);

      await database.approveTag('wheelchair-accessible');
      await database.approveTag('kind');
      await database.approveTag('cool');

      business = await database.getBusinessById(businessId);
      assert.equal(business.tags[0], ['wheelchair-accessible']);
      assert.deepEqual(business.tags.sort(), ['cool', 'kind', 'wheelchair-accessible']);

      const reviews = await database.getBusinessReviewsById(businessId);
      assert.deepEqual(reviews.map(r => r.tags), [
        ['wheelchair-accessible', 'kind'],
        ['wheelchair-accessible', 'cool'],
      ]);

      const review = await database.getReviewById(reviewId1);
      assert.deepEqual(review.tags, ['wheelchair-accessible', 'cool'])
    });

    it("allows ratings to be omitted", async () => {
      await database.createReview(userId, businessId, {
        content: "I love this person deeply.",
        fatRating: 4,
        transRating: NaN,
        categories: ['Doctors']
      });

      const business = await database.getBusinessById(businessId);
      assert.equal(business.transRatingCount, 0);
      assert.equal(business.transAverageRating, null);
      assert.equal(business.fatRatingCount, 1);
      assert.equal(business.fatAverageRating, 4);
    });
  })

  describe(".getBusinessRatingBreakdown", () => {
    it("returns the number of users who gave the business each possible rating in each criteria", async () => {
      const userId1 = await database.createUser({
        facebookId: '1',
        name: 'Bob Carlson',
        email: 'bob@example.com'
      });

      const userId2 = await database.createUser({
        facebookId: '2',
        name: 'Rob Carlson',
        email: 'rob@example.com'
      });

      const userId3 = await database.createUser({
        facebookId: '3',
        name: 'Lob Carlson',
        email: 'lob@example.com'
      });

      const businessId = await database.createBusiness({
        googleId: "dr-brain",
        name: 'Dr Brain',
        address: '123 Main St',
        phone: '555-555-5555',
        latitude: 37.767423217936834,
        longitude: -122.42821739746094
      });

      let breakdown = await database.getBusinessRatingBreakdown(businessId);
      assert.deepEqual(breakdown.fat, {
        1: {count: 0, percentage: 0},
        2: {count: 0, percentage: 0},
        3: {count: 0, percentage: 0},
        4: {count: 0, percentage: 0},
        5: {count: 0, percentage: 0},
        total: 0
      });

      await database.createReview(userId1, businessId, {
        content: "Cool.",
        fatRating: 4,
        transRating: 3,
        categories: ['Doctors']
      });

      await database.createReview(userId2, businessId, {
        content: "Not as cool.",
        fatRating: 4,
        transRating: 2,
        categories: ['Doctors']
      });

      await database.createReview(userId3, businessId, {
        content: "Really cool.",
        fatRating: 5,
        transRating: 2,
        categories: ['Doctors']
      });

      breakdown = await database.getBusinessRatingBreakdown(businessId);
      assert.deepEqual(breakdown.fat, {
        1: {count: 0, percentage: 0},
        2: {count: 0, percentage: 0},
        3: {count: 0, percentage: 0},
        4: {count: 2, percentage: 67},
        5: {count: 1, percentage: 33},
        total: 3
      });
      assert.deepEqual(breakdown.trans, {
        1: {count: 0, percentage: 0},
        2: {count: 2, percentage: 67},
        3: {count: 1, percentage: 33},
        4: {count: 0, percentage: 0},
        5: {count: 0, percentage: 0},
        total: 3
      });
    });
  });

  describe(".updateReview", () => {
    let userId, businessId

    beforeEach(async () => {
      userId = await database.createUser({
        facebookId: '567',
        name: 'Bob Carlson',
        email: 'bob@example.com'
      });

      const otherUserId = await database.createUser({
        facebookId: '890',
        name: 'Rob Carlson',
        email: 'rob@example.com'
      });

      businessId = await database.createBusiness({
        googleId: "dr-brain",
        name: 'Dr Brain',
        address: '123 Main St',
        phone: '555-555-5555',
        latitude: 37.767423217936834,
        longitude: -122.42821739746094
      });

      await database.createReview(otherUserId, businessId, {
        content: "Meh.",
        fatRating: 3,
        transRating: 3,
        pocRating: 5,
        categories: ['Doctors']
      });

      reviewId = await database.createReview(userId, businessId, {
        content: "I love this person deeply.",
        fatRating: 4,
        disabledRating: 4,
        pocRating: 2,
        categories: ['Doctors'],
        tags: ['tag-1', 'tag-2']
      });
    });

    it("updates an existing review and updates the business review information", async() => {
      let business = await database.getBusinessById(businessId);
      assert.equal(business.fatRatingCount, 2);
      assert.equal(business.fatAverageRating, 3.5);
      assert.equal(business.transRatingCount, 1);
      assert.equal(business.transAverageRating, 3);

      await database.updateReview(reviewId, {
        content: "I actually love this person more than I even thought was possible.",
        fatRating: 5,
        transRating: 1,
        pocRating: 5,
        categories: ['Doctors']
      });

      const updatedReview = await database.getReviewById(reviewId);
      business = await database.getBusinessById(businessId);

      assert.equal(updatedReview.content, 'I actually love this person more than I even thought was possible.')
      assert.equal(updatedReview.fatRating, 5);
      assert.equal(updatedReview.transRating, 1);
      assert.equal(updatedReview.disabledRating, null);
      assert.equal(updatedReview.pocRating, 5);


      assert.equal(business.fatRatingCount, 2);
      assert.equal(business.fatAverageRating, 4);
      assert.equal(business.transRatingCount, 2);
      assert.equal(business.transAverageRating, 2);
      assert.equal(business.disabledRatingCount, 0);
      assert.equal(business.disabledAverageRating, null);
      assert.equal(business.pocAverageRating, 5);
      assert.equal(business.pocRatingCount, 2);

    });

    it("updates the review's tags", async () => {
      await database.updateReview(reviewId, {
        content: "I love this person deeply.",
        fatRating: 4,
        disabledRating: 4,
        categories: ['Doctors'],
        tags: ['tag-2', 'tag-3']
      });

      const review = await database.getReviewById(reviewId);
      assert.deepEqual(review.tags, ['tag-2', 'tag-3']);
    });
  });

  describe(".createUser", () => {
    it("allows the user to be retrieved afterwards", async () => {
      const id = await database.createUser({
        facebookId: '5',
        name: 'John Smith',
        email: 'john@example.com',
      });

      const user = await database.getUserById(id)
      assert.deepEqual(user, {
        id,
        facebookId: '5',
        googleId: null,
        name: 'John Smith',
        email: 'john@example.com',
      })
    });
  });

  describe(".getProfileInformationForUser", () => {
    it("gets reviews the user has made", async () => {
      const id = await database.createUser({
        facebookId: '5',
        name: 'John Smith',
        email: 'john@example.com',
      });

      const businessId1 = await database.createBusiness({
        googleId: "dr-brain",
        name: 'Dr Brain',
        address: '123 Main St',
        phone: '555-555-5555',
        latitude: 37.767423217936834,
        longitude: -122.42821739746094
      });

      const businessId2 = await database.createBusiness({
        googleId: "dr-coffee",
        name: 'Dr coffee',
        address: '123 South St',
        phone: '333-555-5555',
        latitude: 37.346923217936834,
        longitude: -122.3456739746094
      });

      const review1 = await database.createReview(id, businessId1, {
        content: "Cool.",
        fatRating: 4,
        categories: ['Doctors']
      });

      const review2 = await database.createReview(id, businessId2, {
        content: "BAD.",
        fatRating: 1,
        categories: ['Doctors']
      });

      const profileInfo = await database.getProfileInformationForUser(id);

      profileInfo.reviews.sort();
      const reviewsContent = [];
      const fatRatings = []
      for (review of profileInfo.reviews) {
        reviewsContent.push(review.content);
        fatRatings.push(review.fatRating);
      }

      assert.deepEqual(reviewsContent, ['Cool.', "BAD."]);
      assert.deepEqual(fatRatings, [4, 1]);
    });
  });

  describe(".findOrCreateUser", () => {
    describe("with a facebook id", () => {
      it("creates a user when none exists with the given facebook id", async () => {
        const id = await database.findOrCreateUser({
          facebookId: '123',
          name: 'Harold',
          email: 'harold@example.com'
        });

        assert.deepEqual(await database.getUserById(id), {
          id,
          facebookId: '123',
          googleId: null,
          name: 'Harold',
          email: 'harold@example.com'
        });
      });

      it("updates a user if one already exists with the given facebook id", async () => {
        const id1 = await database.findOrCreateUser({
          facebookId: '123',
          name: 'Harold',
          email: 'harold@example.com'
        });

        const id2 = await database.findOrCreateUser({
          facebookId: '123',
          name: 'Shmarold',
          email: 'shmarold@example.com'
        });

        assert.equal(id2, id1);
        assert.deepEqual(await database.getUserById(id1), {
          id: id1,
          facebookId: '123',
          googleId: null,
          name: 'Shmarold',
          email: 'shmarold@example.com',
        });
      });

      it("updates a user if one already exists with the given email and a google id", async () => {
        const id1 = await database.findOrCreateUser({
          googleId: '123',
          name: 'Harold',
          email: 'harold@example.com'
        });

        const id2 = await database.findOrCreateUser({
          facebookId: '456',
          name: 'Shmarold',
          email: 'harold@example.com'
        });

        assert.equal(id2, id1);
        assert.deepEqual(await database.getUserById(id1), {
          id: id1,
          facebookId: '456',
          googleId: '123',
          name: 'Shmarold',
          email: 'harold@example.com',
        });
      });
    });

    describe("with a google id", () => {
      it("updates a user if one already exists with the given email (and a different sign in method)", async () => {
        const id1 = await database.findOrCreateUser({
          facebookId: '123',
          name: 'Harold',
          email: 'harold@example.com'
        });

        const id2 = await database.findOrCreateUser({
          googleId: '456',
          name: 'Shmarold',
          email: 'harold@example.com'
        });

        assert.equal(id2, id1);
        assert.deepEqual(await database.getUserById(id1), {
          id: id1,
          facebookId: '123',
          googleId: '456',
          name: 'Shmarold',
          email: 'harold@example.com',
        });
      });

      it("updates a user if one already exists with the given google id", async () => {
        const id1 = await database.findOrCreateUser({
          googleId: '123',
          name: 'Harold',
          email: 'harold@example.com'
        });

        const id2 = await database.findOrCreateUser({
          googleId: '123',
          name: 'Shmarold',
          email: 'shmarold@example.com'
        });

        assert.equal(id2, id1);
        assert.deepEqual(await database.getUserById(id1), {
          id: id1,
          googleId: '123',
          facebookId: null,
          name: 'Shmarold',
          email: 'shmarold@example.com',
        });
      });
    });
  });
});
